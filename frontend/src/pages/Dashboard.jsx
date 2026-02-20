import {onAuthStateChanged} from 'firebase/auth'
import {auth,db} from '../firebase.js'
import { useEffect,useState } from 'react';
import '../App.css'
import './dashboard.css'
import Text from '../dashboard_components/Notes.jsx'
import Chapters from '../dashboard_components/Chapters.jsx';
import Goals from '../dashboard_components/Goals.jsx';
import useOgTags from '../useOgtags.jsx';
import Communicate from '../dashboard_components/Communicate.jsx';
import { useNavigate } from 'react-router-dom';
import { getDoc,doc } from 'firebase/firestore';

export default function Dashboard(){
  useOgTags({
    title: "Dashboard | Ekalavya",
    description: "Ekalavya",
    image:'vite.svg'
  });
  const redirect=useNavigate();
  // (async function(){

  //   const userCredential = await signInWithEmailAndPassword(auth,"vishwaar8@gmail.com",'Webdev27')
  //   console.log("✅ Logged in:", userCredential.user);

  // })();
  
  //const userCredential = await signInWithEmailAndPassword(auth, 'vishwaar8@gmail.com', '123456');
  const [visibility,setVisibility]=useState('open');
  const [workspace_text,workspace_content] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userData,setUserData]=useState({});

    useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log(user)
        setUser(user);
        
      } else {
        setUser(null);
      }
      setLoading(false)
    });

    // Cleanup function
    return () => unsubscribe();
  }, []);
  useEffect(()=>{
    async function GetUserData(){ 
      let usersnapshot=await getDoc(doc(db,'learners',await user.email));
      if (usersnapshot) setUserData(usersnapshot.data());

    }
    if (user) GetUserData()
  },[user])
  useEffect(()=>{
    if (userData.isFirstTime) redirect("/personalisation");
  },[userData])

  if (loading) return <div>Loading...</div>;
  function Call_Component(text){
    if (text==null)
      return
    if (text=='Text'){return <Text user={`${user.email}`}/>}
    if (text=="Chapters") return <Chapters auth={auth} db={db}/>
    if (text=='Goals') return <Goals/>
    if (text=='Communicate') return <Communicate/>

  }
  
  return (
    <>

    
    {/* <div>
            Dashboard
      {user ? (
        <h2>Welcome, {user.email}</h2>
      ) : (
        <h2>Please sign up or log in.</h2>
      )}
    </div> */}
    <div className="main">
      <div className="recaptcha-container"></div>
       <div className={`sidebar ${visibility}`}>
        <div className="sidebar-header">
        <div className="logo">
            <span className='brand'>Ekalavya</span>

        </div>
        <button onClick={()=>{
            if (visibility=='open') setVisibility("collapsed")
            else if (visibility=='collapsed') setVisibility("open")
        }}><span className="fa fa-solid fa-bars"></span></button> 

        </div>
        <button className="comp_btn" onClick={()=>workspace_content("Text")}><span className='fa fa-regular fa-note-sticky'></span> Notes </button>
        <button className="comp_btn" onClick={()=>workspace_content("Chapters")}><span className='fa fa-solid fa-book-open'></span> Chapters </button>
        <button className="comp_btn" onClick={()=>workspace_content("Goals")}><span className='fa fa-solid fa-bullseye'></span> Goals </button>
        <button className="comp_btn" onClick={()=>workspace_content("Communicate")}><span className='fa fa-regular fa-comment'></span> Communicate </button>


      </div>
      <div className="workspace">
        {Call_Component(workspace_text)}
      </div>
    </div>
    </>
  );
}