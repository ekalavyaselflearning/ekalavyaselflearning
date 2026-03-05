import React, { useEffect, useRef, useState } from "react";
import { auth, db } from "../firebase";
import { connect, JSONCodec } from "nats.ws";
import { formatDistanceToNow, format, isToday, isYesterday, isThisWeek } from "date-fns";
import { collection, onSnapshot, query, doc as firestoreDoc } from "firebase/firestore";
import {
  getRoomId,
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  updateOnlineStatus,
  updateLastMessage,
  setUserOffline,
} from "../utils/chatUtils";

export default function Communicate() {
  const [allUsers, setAllUsers] = useState([]);
  const [myChats, setMyChats] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  const ncRef = useRef(null);
  const subRef = useRef(null);
  const typingSubRef = useRef(null);
  const currentRoomRef = useRef(null);
  const jc = JSONCodec();
  const messagesEndRef = useRef(null);
  const lastSentRef = useRef(0);
  const typingTimeoutRef = useRef(null);
  const typingPublishTimeoutRef = useRef(null);

  const currentUserEmail = auth?.currentUser?.email || null;

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Fetch all users with real-time updates
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

  // Fetch my chats
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

  // Listen to selected user's online status in real-time
  useEffect(() => {
    if (!selectedUser) return;

    const userDocRef = firestoreDoc(db, "learners", selectedUser.email);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        setSelectedUser((prev) => ({
          ...prev,
          online: doc.data().online || false,
          lastSeen: doc.data().lastSeen,
        }));
      }
    });

    return () => unsubscribe();
  }, [selectedUser?.email]);

  // Update online status and handle cleanup
  useEffect(() => {
    if (!currentUserEmail) return;

    // Set online
    updateOnlineStatus(currentUserEmail, true);

    // Handle page unload/close
    const handleBeforeUnload = async () => {
      await setUserOffline(currentUserEmail);
    };

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setUserOffline(currentUserEmail);
      } else {
        updateOnlineStatus(currentUserEmail, true);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      setUserOffline(currentUserEmail);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentUserEmail]);

  // Connect to NATS
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

  // Handle user selection
  async function handleUserClick(user) {
    setSelectedUser(user);
    setMessages([]);
    setOtherUserTyping(false);
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

  // Load chat room and subscribe
  async function loadChatRoom(roomId) {
    if (!ncRef.current) {
      setStatus("Not connected");
      return;
    }

    // Unsubscribe from previous room
    if (subRef.current) {
      try {
        await subRef.current.drain();
      } catch (e) {
        console.error("Error draining subscription", e);
      }
    }

    // Unsubscribe from previous typing channel
    if (typingSubRef.current) {
      try {
        await typingSubRef.current.drain();
      } catch (e) {
        console.error("Error draining typing subscription", e);
      }
    }

    currentRoomRef.current = roomId;
    setStatus("Loading...");

    try {
      // First, load message history
      await loadChats(roomId);

      // Then subscribe to new messages
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
              setMessages((prev) => {
                // Avoid duplicates
                const exists = prev.some(msg => 
                  msg.from === data.from && 
                  msg.text === data.text && 
                  Math.abs((msg.createdAt || 0) - (data.createdAt || 0)) < 1000
                );
                if (exists) return prev;
                return [...prev, { ...data, id: `msg-${Date.now()}-${Math.random()}` }];
              });
            }
          } catch (err) {
            console.error("Failed to decode message", err);
          }
        }
      })();

      // Subscribe to typing indicators
      const typingSubj = `chat.typing.${roomId}`;
      const typingSub = ncRef.current.subscribe(typingSubj);
      typingSubRef.current = typingSub;

      (async () => {
        for await (const m of typingSub) {
          try {
            const data = jc.decode(m.data);
            if (data.user !== currentUserEmail) {
              setOtherUserTyping(data.isTyping);
              
              // Auto-hide after 3 seconds
              if (data.isTyping) {
                if (typingTimeoutRef.current) {
                  clearTimeout(typingTimeoutRef.current);
                }
                typingTimeoutRef.current = setTimeout(() => {
                  setOtherUserTyping(false);
                }, 3000);
              }
            }
          } catch (err) {
            console.error("Failed to decode typing indicator", err);
          }
        }
      })();

      setStatus("Connected");
    } catch (err) {
      console.error("Failed to subscribe to room", err);
      setStatus("Failed to load");
    }
  }

  // Load message history from JetStream

  async function loadChats(roomId, limit = 100) {
    setStatus("Loading messages...");

    try {
      console.log("📚 Fetching messages from API for room:", roomId);
      
      const response = await fetch(
        `http://localhost:3001/api/rooms/${encodeURIComponent(roomId)}/messages?limit=${limit}`
      );
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log(`✅ Loaded ${data.count} messages from API`);
      
      setMessages(data.messages);
      setStatus("Connected");
    } catch (err) {
      console.error("❌ Failed to load chat history:", err);
      setStatus("Connected"); // Don't block - user can still send new messages
    }
  }
  // async function loadChats(roomId, limit = 100) {
  //   if (!ncRef.current) {
  //     console.error("NATS connection not available");
  //     return;
  //   }

  //   setStatus("Loading messages...");

  //   try {
  //     const js = ncRef.current.jetstream();
  //     const streamName = "CHAT_ROOMS";

  //     // Verify stream exists
  //     try {
  //       const streamInfo = await js.streams.info(streamName);
  //       console.log("✅ Stream found:", streamInfo);
  //     } catch (err) {
  //       console.warn("⚠️ Stream not found:", err);
  //       setStatus("Connected");
  //       return;
  //     }

  //     // Create an ordered consumer for history
  //     const consumer = await js.consumers.get(streamName);
      
  //     // Fetch messages for this specific room
  //     const iter = await consumer.consume({
  //       max_messages: limit,
  //       expires: 10000, // 10 seconds timeout
  //     });

  //     const loadedMessages = [];
  //     let messageCount = 0;

  //     try {
  //       for await (const m of iter) {
  //         messageCount++;
          
  //         // Check if message is for our room
  //         if (!m.subject.includes(roomId)) {
  //           m.ack();
  //           continue;
  //         }

  //         try {
  //           const data = jc.decode(m.data);
  //           console.log("📨 Loaded message:", data);

  //           if (data && !data.system) {
  //             loadedMessages.push({
  //               ...data,
  //               id: `history-${m.seq}-${Date.now()}-${Math.random()}`,
  //             });
  //           } else if (data && data.system && (data.type === "join" || data.type === "left")) {
  //             loadedMessages.push({
  //               ...data,
  //               id: `history-sys-${m.seq}-${Date.now()}-${Math.random()}`,
  //             });
  //           }

  //           m.ack();
  //         } catch (decodeErr) {
  //           console.error("Failed to decode message:", decodeErr);
  //           m.ack();
  //         }
  //       }
  //     } catch (iterErr) {
  //       console.log("Iterator ended or timed out:", iterErr.message);
  //     }

  //     console.log(`📚 Loaded ${loadedMessages.length} messages from history`);

  //     // Sort by timestamp
  //     loadedMessages.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  //     setMessages(loadedMessages);
  //     setStatus("Connected");
  //   } catch (err) {
  //     console.error("❌ Failed to load chat history:", err);
  //     setStatus("Connected"); // Don't block - user can still send new messages
  //   }
  //   debugJetStream();
  // }
  // Add this function after loadChats()
async function debugJetStream() {
  if (!ncRef.current) return;
  
  try {
    const js = ncRef.current.jetstream();
    const streamInfo = await js.streams.info("CHAT_ROOMS");
    console.log("🔍 Stream Info:", {
      name: streamInfo.config.name,
      messages: streamInfo.state.messages,
      subjects: streamInfo.state.subjects,
    });
    
    // List all messages in stream
    const consumer = await js.consumers.get("CHAT_ROOMS");
    const msgs = await consumer.consume({ max_messages: 50, expires: 5000 });
    
    let count = 0;
    for await (const m of msgs) {
      console.log(`Message ${++count}:`, {
        subject: m.subject,
        seq: m.seq,
        data: jc.decode(m.data)
      });
      m.ack();
    }
  } catch (err) {
    console.error("Debug error:", err);
  }
}

// Call this after connecting to a room (temporary)
// Add to end of loadChatRoom() function:
// await debugJetStream();

  // Send connection request
  async function handleSendRequest(targetUserEmail) {
    try {
      await sendConnectionRequest(currentUserEmail, targetUserEmail);
      setStatus("Request sent");
    } catch (err) {
      console.error("Error sending request", err);
      setStatus("Failed to send");
    }
  }

  // Accept request
  async function handleAcceptRequest(targetUserEmail) {
    try {
      await acceptConnectionRequest(currentUserEmail, targetUserEmail);
      setStatus("Request accepted");
      
      // Wait a bit for Firestore to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const chatData = myChats[targetUserEmail];
      if (chatData && chatData.roomId) {
        await loadChatRoom(chatData.roomId);
      }
    } catch (err) {
      console.error("Error accepting request", err);
      setStatus("Failed to accept");
    }
  }

  // Reject request
  async function handleRejectRequest(targetUserEmail) {
    try {
      await rejectConnectionRequest(currentUserEmail, targetUserEmail);
      setStatus("Request rejected");
    } catch (err) {
      console.error("Error rejecting request", err);
      setStatus("Failed to reject");
    }
  }

  // Publish typing indicator
  function publishTypingIndicator(isTyping) {
    if (!ncRef.current || !currentRoomRef.current) return;

    const payload = {
      user: currentUserEmail,
      isTyping,
      timestamp: Date.now(),
    };

    try {
      ncRef.current.publish(`chat.typing.${currentRoomRef.current}`, jc.encode(payload));
    } catch (err) {
      console.error("Failed to publish typing indicator", err);
    }
  }

  // Handle input change with typing indicator
  function handleInputChange(e) {
    const value = e.target.value;
    setInput(value);

    // Publish typing indicator
    if (value.length > 0 && !isTyping) {
      setIsTyping(true);
      publishTypingIndicator(true);
    }

    // Debounce - stop typing after 2 seconds of no input
    if (typingPublishTimeoutRef.current) {
      clearTimeout(typingPublishTimeoutRef.current);
    }

    typingPublishTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      publishTypingIndicator(false);
    }, 2000);
  }

  // Rate limiting
  function canSend() {
    const now = Date.now();
    return now - lastSentRef.current >= 1000;
  }

  // Send message
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

      // Stop typing indicator
      setIsTyping(false);
      publishTypingIndicator(false);

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

  // Get chat status for button
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

  // Handle chat action
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

  // Format message timestamp
  function formatMessageTime(timestamp) {
    if (!timestamp) return "now";
    const date = new Date(timestamp);

    if (isToday(date)) {
      return format(date, "h:mm a");
    } else if (isYesterday(date)) {
      return "Yesterday";
    } else if (isThisWeek(date)) {
      return format(date, "EEEE"); // Day name
    } else {
      return format(date, "MMM d, yyyy");
    }
  }

  // Group messages by date
  function groupMessagesByDate(messages) {
    const groups = [];
    let currentDate = null;

    messages.forEach((msg) => {
      const msgDate = msg.createdAt ? format(new Date(msg.createdAt), "yyyy-MM-dd") : null;

      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({
          type: "date-separator",
          date: msg.createdAt ? new Date(msg.createdAt) : new Date(),
          id: `date-${msgDate}`,
        });
      }

      groups.push(msg);
    });

    return groups;
  }

  // Format date separator
  function formatDateSeparator(date) {
    if (isToday(date)) {
      return "Today";
    } else if (isYesterday(date)) {
      return "Yesterday";
    } else {
      return format(date, "MMMM d, yyyy");
    }
  }

  const filteredUsers = allUsers.filter((user) =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedMessages = groupMessagesByDate(messages);

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
            <span className="user-email">{currentUserEmail.split("@")[0]}</span>
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
                  className={`chat-user-item ${selectedUser?.email === user.email ? "active" : ""}`}
                >
                  <div className="user-avatar">
                    <div className="avatar-circle">{user.email.charAt(0).toUpperCase()}</div>
                    <div className={`status-dot ${isOnline ? "online" : "offline"}`}></div>
                  </div>

                  <div className="user-info">
                    <div className="user-name">{user.email.split("@")[0]}</div>
                    {chatData?.lastMessage && (
                      <div className="last-message">
                        {chatData.lastMessage.substring(0, 30)}
                        {chatData.lastMessage.length > 30 ? "..." : ""}
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
                      background: chatStatus.disabled ? "#e5e7eb" : chatStatus.color,
                      cursor: chatStatus.disabled ? "not-allowed" : "pointer",
                      opacity: chatStatus.disabled ? 0.6 : 1,
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
                <div className="header-avatar">{selectedUser.email.charAt(0).toUpperCase()}</div>
                <div className="header-info">
                  <h3>{selectedUser.email.split("@")[0]}</h3>
                  <span className={`status-text ${selectedUser.online ? "online" : "offline"}`}>
                    {otherUserTyping ? (
                      <span className="typing-indicator">typing...</span>
                    ) : selectedUser.online ? (
                      "Online"
                    ) : (
                      "Offline"
                    )}
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
                      <p>{selectedUser.email.split("@")[0]} wants to connect with you</p>
                      <div className="prompt-actions">
                        <button onClick={() => handleAcceptRequest(selectedUser.email)} className="btn-accept">
                          Accept
                        </button>
                        <button onClick={() => handleRejectRequest(selectedUser.email)} className="btn-reject">
                          Decline
                        </button>
                      </div>
                    </div>
                  ) : myChats[selectedUser.email]?.status === "pending" ? (
                    <div className="prompt-card">
                      <div className="prompt-icon">⏳</div>
                      <h3>Request Sent</h3>
                      <p>Waiting for {selectedUser.email.split("@")[0]} to accept your connection request</p>
                    </div>
                  ) : (
                    <div className="prompt-card">
                      <div className="prompt-icon">✨</div>
                      <h3>Start a Conversation</h3>
                      <p>Send a connection request to start chatting with {selectedUser.email.split("@")[0]}</p>
                      <button onClick={() => handleSendRequest(selectedUser.email)} className="btn-connect">
                        Send Request
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="messages-container">
                  {groupedMessages.length === 0 ? (
                    <div className="empty-chat">
                      <div className="empty-chat-icon">💬</div>
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    groupedMessages.map((item) => {
                      if (item.type === "date-separator") {
                        return (
                          <div key={item.id} className="date-separator">
                            <span>{formatDateSeparator(item.date)}</span>
                          </div>
                        );
                      }

                      const isMe = item.from === currentUserEmail;
                      return (
                        <div key={item.id} className={`message ${isMe ? "message-sent" : "message-received"}`}>
                          <div className="message-bubble">
                            {!isMe && <div className="message-sender">{item.from.split("@")[0]}</div>}
                            <div className="message-text">{item.text}</div>
                            <div className="message-time">{formatMessageTime(item.createdAt)}</div>
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
                  onChange={handleInputChange}
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