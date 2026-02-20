import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useState, useEffect } from 'react';

export default function Goals({ user }) {
  const [chaps, setChaps] = useState({ Compulsory: {} });
  const [selectedSubject, setSelectedSubject] = useState('');
  
  useEffect(() => {
    async function fetchData() {
      const snap = await getDoc(doc(db, 'learners', 'vishwaar8@gmail.com'));
      const data = snap.data().chapters;
      setChaps(data);
    }

    fetchData();
  }, []);

  const handleSubjectChange = (e) => {
    setSelectedSubject(e.target.value);
  };

  return (
    <div className="selection">
      <select id="subject" onChange={handleSubjectChange}>
        <option value='defaut'>--Select a Subject--</option>
        {Object.keys(chaps.Compulsory || {}).map((key, index) => (
          <option key={index} value={key}>
            {key}
          </option>
        ))}
      </select>

      <select id="chapter">
        {selectedSubject &&
          chaps.Compulsory[selectedSubject].map((topic, index) => (
            <option key={index} value={topic}>
              {topic}
            </option>
          ))}
      </select>
    </div>
  );
}
