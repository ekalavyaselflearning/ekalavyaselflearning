import {getDoc,doc} from 'firebase/firestore';
import {db} from '../firebase'
import { useEffect,useState } from 'react';


export default function NotesTable({user}){
    const [notes,setNotes] = useState(null);
    useEffect(() => {
        async function fetchNotes() {
            if (!user) return;

            const snap = await getDoc(doc(db, "Notes", user));
            const data = snap.exists() ? snap.data() : null;
            setNotes(data);
        }

        fetchNotes();
    }, [user]);
    console.log(notes)
    return (
    <table>
        <tbody>
            <tr>
                <th>Title</th>
                <th>Notes</th>
                <th>Files</th>
                <th>Actions</th>
            </tr>
        {notes &&
            Object.keys(notes).map((key) => (
            <tr key={key}>
                <td>{notes[key].title}</td>
                <td>{notes[key].notes}</td>
                <td>{notes[key].files.length}</td>
                <td>
                    <button onClick={()=>edit_action(notes[key])}><span className='fa fa-solid fa-pencil'></span></button>
                    <button onClick={()=>del_notes(notes[key])}><span className='fa fa-solid fa-trash'></span></button>

                </td>
            </tr>
            ))}
        </tbody>
    </table>
);

}