import React, { useEffect, useRef, useState } from "react";
import { auth, db } from "../firebase";
import { connect, JSONCodec } from "nats.ws";
import { formatDistanceToNow } from "date-fns";
import { collection, onSnapshot, query } from "firebase/firestore";
import {
  getRoomId,
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  updateOnlineStatus,
  updateLastMessage,
} from "../utils/chatUtils";

export default function Communicate() {
  const [allUsers, setAllUsers] = useState([]);
  const [myChats, setMyChats] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("idle");
  const [searchQuery, setSearchQuery] = useState("");

  const ncRef = useRef(null);
  const subRef = useRef(null);
  const currentRoomRef = useRef(null);
  const jc = JSONCodec();
  const messagesEndRef = useRef(null);
  const lastSentRef = useRef(0);

  const currentUserEmail = auth?.currentUser?.email || null;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!currentUserEmail) return;
    const unsubscribe = onSnapshot(query(collection(db, "learners")), (snapshot) => {
      const users = snapshot.docs
        .map((doc) => ({ email: doc.id, ...doc.data() }))
        .filter((u) => u.email !== currentUserEmail);
      setAllUsers(users);
    });
    return () => unsubscribe();
  }, [currentUserEmail]);

  useEffect(() => {
    if (!currentUserEmail) return;
    const unsubscribe = onSnapshot(
      query(collection(db, "learners", currentUserEmail, "chats")),
      (snapshot) => {
        const chats = {};
        snapshot.docs.forEach((doc) => {
          chats[doc.id] = doc.data();
        });
        setMyChats(chats);
      }
    );
    return () => unsubscribe();
  }, [currentUserEmail]);

  useEffect(() => {
    if (!currentUserEmail) return;
    updateOnlineStatus(currentUserEmail, true);
    return () => {
      updateOnlineStatus(currentUserEmail, false);
    };
  }, [currentUserEmail]);

  useEffect(() => {
    if (!currentUserEmail) return;
    (async () => {
      try {
        const nc = await connect({ servers: "ws://localhost:8080" });
        ncRef.current = nc;
        setStatus("connected");
      } catch (err) {
        console.error("Failed to connect to NATS", err);
        setStatus("connection failed");
      }
    })();
    return () => {
      if (ncRef.current) {
        ncRef.current.close();
      }
    };
  }, [currentUserEmail]);

  async function handleUserClick(user) {
    setSelectedUser(user);
    setMessages([]);
    const chatData = myChats[user.email];

    if (!chatData) {
      setStatus("No connection yet");
      return;
    }

    if (chatData.status === "pending") {
      if (chatData.initiatedBy === currentUserEmail) {
        setStatus("Waiting for acceptance");
      } else {
        setStatus("Pending request");
      }
      return;
    }

    if (chatData.status === "rejected") {
      setStatus("Request rejected");
      return;
    }

    if (chatData.status === "accepted") {
      await loadChatRoom(chatData.roomId);
    }
  }

  async function loadChatRoom(roomId) {
    if (!ncRef.current) {
      setStatus("Not connected");
      return;
    }

    if (subRef.current) {
      try {
        await subRef.current.drain();
      } catch (e) {
        console.error("Error draining subscription", e);
      }
    }

    currentRoomRef.current = roomId;
    setStatus("Loading...");

    try {
      const subj = `chat.room.${roomId}`;
      const sub = ncRef.current.subscribe(subj);
      subRef.current = sub;

      (async () => {
        for await (const m of sub) {
          try {
            const data = jc.decode(m.data);
            if (data && data.system) {
              setMessages((prev) => [...prev, { ...data, id: `sys-${Date.now()}-${Math.random()}` }]);
            } else {
              setMessages((prev) => [...prev, { ...data, id: `msg-${Date.now()}-${Math.random()}` }]);
            }
          } catch (err) {
            console.error("Failed to decode message", err);
          }
        }
      })();

      setStatus("Connected");
    } catch (err) {
      console.error("Failed to subscribe to room", err);
      setStatus("Failed to load");
    }
  }

  async function handleSendRequest(targetUserEmail) {
    try {
      await sendConnectionRequest(currentUserEmail, targetUserEmail);
      setStatus("Request sent");
    } catch (err) {
      console.error("Error sending request", err);
      setStatus("Failed to send");
    }
  }

  async function handleAcceptRequest(targetUserEmail) {
    try {
      await acceptConnectionRequest(currentUserEmail, targetUserEmail);
      setStatus("Request accepted");
      const chatData = myChats[targetUserEmail];
      if (chatData && chatData.roomId) {
        await loadChatRoom(chatData.roomId);
      }
    } catch (err) {
      console.error("Error accepting request", err);
      setStatus("Failed to accept");
    }
  }

  async function handleRejectRequest(targetUserEmail) {
    try {
      await rejectConnectionRequest(currentUserEmail, targetUserEmail);
      setStatus("Request rejected");
    } catch (err) {
      console.error("Error rejecting request", err);
      setStatus("Failed to reject");
    }
  }

  function canSend() {
    const now = Date.now();
    return now - lastSentRef.current >= 1000;
  }

  async function sendMessage() {
    if (!ncRef.current || !currentRoomRef.current) {
      setStatus("Not connected");
      return;
    }
    if (!input || input.trim() === "") return;
    if (!canSend()) {
      setStatus("Slow down!");
      return;
    }

    const payload = {
      from: currentUserEmail,
      text: input.trim(),
      createdAt: Date.now(),
    };

    try {
      ncRef.current.publish(`chat.room.${currentRoomRef.current}`, jc.encode(payload));
      lastSentRef.current = Date.now();

      if (selectedUser) {
        await updateLastMessage(currentUserEmail, selectedUser.email, input.trim());
      }

      setInput("");
      setStatus("Sent");
    } catch (e) {
      console.error("Failed to publish message", e);
      setStatus("Failed");
    }
  }

  function getChatStatus(user) {
    const chatData = myChats[user.email];
    if (!chatData) return { label: "Connect", color: "#3067cd", disabled: false };
    
    if (chatData.status === "pending") {
      if (chatData.initiatedBy === currentUserEmail) {
        return { label: "Pending", color: "#9ca3af", disabled: true };
      }
      return { label: "Accept", color: "#10b981", disabled: false };
    }

    if (chatData.status === "rejected") {
      return { label: "Rejected", color: "#ef4444", disabled: true };
    }

    if (chatData.status === "accepted") {
      return { label: "Open", color: "#3067cd", disabled: false };
    }

    return { label: "Connect", color: "#3067cd", disabled: false };
  }

  function handleChatAction(user) {
    const chatData = myChats[user.email];

    if (!chatData) {
      handleSendRequest(user.email);
      return;
    }

    if (chatData.status === "pending" && chatData.initiatedBy !== currentUserEmail) {
      handleAcceptRequest(user.email);
      return;
    }
  }

  const filteredUsers = allUsers.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!currentUserEmail) {
    return (
      <div className="chat-container">
        <div className="chat-error">
          <div className="error-icon">🔒</div>
          <h2>Authentication Required</h2>
          <p>Please sign in to access the chat system</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {/* LEFT SIDEBAR */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <div className="sidebar-title">
            <span className="sidebar-icon">💬</span>
            <h2>Messages</h2>
          </div>
          <div className="sidebar-user-info">
            <span className="user-email">{currentUserEmail.split('@')[0]}</span>
            <div className="online-indicator"></div>
          </div>
        </div>

        <div className="chat-search">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="chat-user-list">
          {filteredUsers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <p>No users found</p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const chatData = myChats[user.email];
              const isOnline = user.online || false;
              const isPending = chatData?.status === "pending";
              const needsResponse = isPending && chatData?.initiatedBy !== currentUserEmail;
              const chatStatus = getChatStatus(user);

              return (
                <div
                  key={user.email}
                  onClick={() => handleUserClick(user)}
                  className={`chat-user-item ${selectedUser?.email === user.email ? 'active' : ''}`}
                >
                  <div className="user-avatar">
                    <div className="avatar-circle">
                      {user.email.charAt(0).toUpperCase()}
                    </div>
                    <div className={`status-dot ${isOnline ? 'online' : 'offline'}`}></div>
                  </div>

                  <div className="user-info">
                    <div className="user-name">{user.email.split('@')[0]}</div>
                    {chatData?.lastMessage && (
                      <div className="last-message">
                        {chatData.lastMessage.substring(0, 30)}
                        {chatData.lastMessage.length > 30 ? '...' : ''}
                      </div>
                    )}
                    {needsResponse && (
                      <div className="request-badge">
                        <span className="badge-icon">⚡</span>
                        Connection request
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChatAction(user);
                    }}
                    disabled={chatStatus.disabled}
                    className="chat-action-btn"
                    style={{ 
                      background: chatStatus.disabled ? '#e5e7eb' : chatStatus.color,
                      cursor: chatStatus.disabled ? 'not-allowed' : 'pointer',
                      opacity: chatStatus.disabled ? 0.6 : 1
                    }}
                  >
                    {chatStatus.label}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT CHAT PANEL */}
      <div className="chat-main">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <div className="chat-header-user">
                <div className="header-avatar">
                  {selectedUser.email.charAt(0).toUpperCase()}
                </div>
                <div className="header-info">
                  <h3>{selectedUser.email.split('@')[0]}</h3>
                  <span className={`status-text ${selectedUser.online ? 'online' : 'offline'}`}>
                    {selectedUser.online ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
              <div className="chat-status-badge">{status}</div>
            </div>

            <div className="chat-messages">
              {myChats[selectedUser.email]?.status !== "accepted" ? (
                <div className="connection-prompt">
                  {myChats[selectedUser.email]?.status === "pending" &&
                  myChats[selectedUser.email]?.initiatedBy !== currentUserEmail ? (
                    <div className="prompt-card">
                      <div className="prompt-icon">🤝</div>
                      <h3>Connection Request</h3>
                      <p>{selectedUser.email.split('@')[0]} wants to connect with you</p>
                      <div className="prompt-actions">
                        <button
                          onClick={() => handleAcceptRequest(selectedUser.email)}
                          className="btn-accept"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectRequest(selectedUser.email)}
                          className="btn-reject"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ) : myChats[selectedUser.email]?.status === "pending" ? (
                    <div className="prompt-card">
                      <div className="prompt-icon">⏳</div>
                      <h3>Request Sent</h3>
                      <p>Waiting for {selectedUser.email.split('@')[0]} to accept your connection request</p>
                    </div>
                  ) : (
                    <div className="prompt-card">
                      <div className="prompt-icon">✨</div>
                      <h3>Start a Conversation</h3>
                      <p>Send a connection request to start chatting with {selectedUser.email.split('@')[0]}</p>
                      <button
                        onClick={() => handleSendRequest(selectedUser.email)}
                        className="btn-connect"
                      >
                        Send Request
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="messages-container">
                  {messages.length === 0 ? (
                    <div className="empty-chat">
                      <div className="empty-chat-icon">💬</div>
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isMe = m.from === currentUserEmail;
                      return (
                        <div key={m.id} className={`message ${isMe ? 'message-sent' : 'message-received'}`}>
                          <div className="message-bubble">
                            {!isMe && <div className="message-sender">{m.from.split('@')[0]}</div>}
                            <div className="message-text">{m.text}</div>
                            <div className="message-time">
                              {m.createdAt
                                ? formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })
                                : "now"}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {myChats[selectedUser.email]?.status === "accepted" && (
              <div className="chat-input-container">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  className="chat-input"
                />
                <button onClick={sendMessage} className="send-btn" disabled={!input.trim()}>
                  <span className="send-icon">📤</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="chat-empty-state">
            <div className="empty-state-content">
              <div className="empty-state-icon">💬</div>
              <h2>Welcome to Messages</h2>
              <p>Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}