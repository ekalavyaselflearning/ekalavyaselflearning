import { useState, useEffect,useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {getDocs,doc,collection,updateDoc,setDoc} from 'firebase/firestore';
import {TextField,Button,Checkbox} from "@mui/material";
import {auth} from '../firebase'
export default function Chapters({ auth, db }) {
  const [compulsorySubjects, setCompulsorySubjects] = useState({});
  const [optionals, setOptionals] = useState({});
  const [collapsedItems, setCollapsedItems] = useState({});
  const [selectedOptionals, setSelectedOptionals] = useState([]);
  const [addingSubject, setAddingSubject] = useState(null);
  const [newSubtopic, setNewSubtopic] = useState("");
  const additional_input = useRef(null);
  const [compulsoryUpdate,setCompulsoryUpdate] = useState(1);
  const [optionalUpdate,setOptionalUpdate] = useState(1);
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);
  const cached = localStorage.getItem("syllabus");
  const initialSyllabus = cached ? JSON.parse(cached) : null;
  useEffect(() => {
  const fetchSyllabus = async () => {
    if (!initialSyllabus) {
      try {
        const data = await getSyllabus();
        localStorage.setItem("syllabus", JSON.stringify(data));
        setCompulsorySubjects(data.Compulsory);
        setOptionals(data.Optional);
      } catch (e) {
        console.error(e);
      }
    } else {
      // use cached data
      setCompulsorySubjects(initialSyllabus.Compulsory);
      setOptionals(initialSyllabus.Optional);
    }
  };

  fetchSyllabus();
}, []);

async function getSyllabus() {
  const syllabus = { Compulsory: {}, Optional: {} };
  try{

    const compulsory_subs = await getDocs(collection(db, "Syllabus_Compulsory"));
    compulsory_subs.forEach(doc => {
      syllabus.Compulsory[doc.id] = Object.values(doc.data());
    });
  
    const optional_subs = await getDocs(collection(db, "Syllabus_Optional"));
    optional_subs.forEach(doc => {
      syllabus.Optional[doc.id] = Object.values(doc.data());
    });
  }
  catch(e){
    console.error(e)
  }

  return syllabus;
}


  

  



  const toggleCollapse = (key) => {
    setCollapsedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handlePlusClick = (subject, e) => {
    e.stopPropagation();
    
    if (selectedOptionals.includes(subject)) {
      // Remove subject if already selected
      setSelectedOptionals(prev => prev.filter(s => s !== subject));
    } else if (selectedOptionals.length < 2) {
      // Add subject if less than 2 are selected
      setSelectedOptionals(prev => [...prev, subject]);
    }
  };

  const handleSaveToDb = async () => {
    try {
      if (auth?.currentUser?.email) {
        await setDoc(doc(db,"learners",await auth.currentUser.email),{
          Compulsory:compulsorySubjects,
          Optional:selectedSubtopic
        })
        alert("Successfully saved to database");
      }
    } catch (error) {
      console.error("Error saving to database:", error);
      alert("Error saving to database");
    }
  };
  /*Function to customize <subtopics>*/
  function add_topic(subject){
    setAddingSubject(subject);
    
  }
  useEffect(() => {
  if (additional_input.current) {
    additional_input.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}, [addingSubject]);

async function saveSubtopic(subject,compulsory,subtopic){
  if (!subtopic.length) {alert("Invalid length for sub topic"); return;}
    else{
      if (compulsory) {
        
        compulsorySubjects[subject].push(subtopic)
        setCompulsorySubjects(compulsorySubjects)
        setCompulsoryUpdate(compulsoryUpdate+1);
        setNewSubtopic('');

      }
      else{
        pass
      }
    }
  
}




  const renderSubjects = (subjects, isCompulsory = false) => {
    return Object.keys(subjects).map((subject, index) => {
      const key = `${isCompulsory ? 'comp' : 'opt'}-${index}`;
      const isCollapsed = collapsedItems[key];
      const isSelected = selectedOptionals.includes(subject);
      const isDisabled = !isCompulsory && !isSelected && selectedOptionals.length >= 2;

      return (
        <div key={key} className={`tree-node ${subject}`}>
          <div 
            className={`tree-item chapter ${isCollapsed ? 'collapsed' : ''}`}
            onClick={() => toggleCollapse(key)}
          >
            <div>
              <span 
                className="toggle-icon"
                style={{
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }}
              >
                ▼
              </span>
              <span>{subject}</span>

            </div>
            {isCompulsory&&(<acronym onClick={(e)=>{
              e.stopPropagation();
              add_topic(subject)}} title="Click to add subtopics">
              <button onClick={(e)=>{
                e.stopPropagation();
                add_topic(subject)}}><span className='fa fa-solid fa-plus'></span></button>

            </acronym>)}
          </div>
          <div className={`collapsible-content ${isCollapsed ? 'collapsed' : ''}`}>
  {subjects[subject].map((subtopic, subIndex) => (
    <div key={subIndex} className={`tree-item subtopic`}>
      {subtopic}
      {!isCompulsory && (
            <div>
              <Checkbox 
                checked={subtopic==selectedSubtopic}
                onChange={(e)=>e.currentTarget.checked?setSelectedSubtopic(subtopic):setSelectedSubtopic(null)}
                disabled={subtopic!=selectedSubtopic && selectedSubtopic!=null}
              />
            </div>
          )}
        </div>

              
            ))}
            {addingSubject === subject && (
                <div className="additional_input tree-item subtopic">
                  <TextField
                    variant="outlined"
                    label='Add Sub Topic'
                    inputRef={additional_input}
                    value={newSubtopic}
                    onChange={(e) => setNewSubtopic(e.target.value)}
                  />
                  <Button onClick={() => saveSubtopic(subject,isCompulsory,newSubtopic)} color="success">
                    <span className="fa fa-solid fa-check"></span>
                  </Button>
                </div>
              )}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="dashboard-content" id="Chapters">
      <div className="chapters">
        <div className="subjects-container" id="compulsory">
          <div className="subjects-header">
            Compulsory Subjects
          </div>
          <div className="tree-container">
            {compulsoryUpdate && renderSubjects(compulsorySubjects, true)}
          </div>
        </div>
        <div className="subjects-container" id="optional">
          <div className="subjects-header">
            Optional Subjects ({selectedOptionals.length}/1 selected)
          </div>
          <div className="tree-container">
            {optionalUpdate && renderSubjects(optionals, false)}
          </div>
        </div>
      </div>
      <center>
        <button id="savetodb" className="save-btn" onClick={handleSaveToDb}>
          <span className="fa fa-solid fa-upload"></span> Save to Database
        </button>
      </center>
    </div>
  );
}