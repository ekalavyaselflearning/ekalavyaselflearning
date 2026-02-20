import "../App.css"
import './signup.css'
import {useState,useEffect} from 'react'
import useOgTags from '../useOgTags.jsx'
import { createUserWithEmailAndPassword } from "firebase/auth"
import { setDoc,doc } from "firebase/firestore"
import {auth,db} from '../firebase.js'
import { HandCoins } from "lucide-react"
import { useNavigate } from "react-router-dom"
export default function Signup(){

    const [newUserData,setnewUserData]=useState({});
    const [signupVisibility,setSignUpVisibility]=useState('');
    const [pwdVisibility,setPwdVisibility]=useState('hide');
    const [email,displayEmail]=useState('');
    const [Name,setName]=useState('')
    const [passwd,setPasswd]=useState('')
    const [conpasswd,setConPasswd]=useState('')
    const redirect=useNavigate();




    //Adding title tags
    useOgTags({
        title: "SignUp | Ekalavya",
        description: "Ekalavya",
        image:'logo.png'
      });
    let [index,changeIndexTo]=useState(0);
    let carousel_html=[
        <div className="carousel-slide active">
            <div className="slide-icon">🎓</div>
            <div className="slide-quote">The future belongs to those who believe in the beauty of their dreams</div>
            <div className="slide-author">Eleanor Roosevelt</div>
            <div className="slide-subtitle">Start your transformation today</div>
        </div>,
        
        <div className="carousel-slide">
            <div className="slide-icon">🚀</div>
            <div className="slide-quote">Success is not final, failure is not fatal: it is the courage to continue that counts</div>
            <div className="slide-author">Winston Churchill</div>
            <div className="slide-subtitle">Every expert was once a beginner</div>
        </div>,
        
        <div className="carousel-slide">
            <div className="slide-icon">💡</div>
            <div className="slide-quote">Education is the most powerful weapon which you can use to change the world</div>
            <div className="slide-author">Nelson Mandela</div>
            <div className="slide-subtitle">Knowledge is your superpower</div>
        </div>,
        
        <div className="carousel-slide">
            <div className="slide-icon">🌟</div>
            <div className="slide-quote">The only impossible journey is the one you never begin</div>
            <div className="slide-author">Tony Robbins</div>
            <div className="slide-subtitle">Your journey starts here</div>
        </div>,
        
        <div className="carousel-slide">
            <div className="slide-icon">🏆</div>
            <div className="slide-quote">Don't watch the clock; do what it does. Keep going</div>
            <div className="slide-author">Sam Levenson</div>
            <div className="slide-subtitle">Persistence is your key to success</div>
        </div>

    ];
    setTimeout(()=>{changeIndexTo((index+1)%carousel_html.length)},5000)
    useEffect(()=>{
        const radios=document.querySelectorAll(".indicator")
        for (let radio of radios){
            if (radio.getAttribute("data-slide")==index){
                radio.classList.add("active")
            }else radio.classList.remove("active")
        }
    },[index])

    const handleChange=(e)=>{setnewUserData({...newUserData,[e.target.name]:e.target.value})}

    const handleSubmit=async (e)=>{
        e.preventDefault();
        //await setDoc(doc(db,'learners',newUserData.email),newUserData);
        setSignUpVisibility('hide')
        setPwdVisibility('');
        displayEmail(newUserData.email)
        setName(newUserData.firstName+' '+newUserData.lastName);
    }
    const handlePwdSubmit=async (e)=>{
        e.preventDefault();
        console.log(newUserData)
        if (newUserData.password!=newUserData.conpasswd){
            alert("Passwords do not match")
            return;
        }
        try{

            await createUserWithEmailAndPassword(auth,newUserData.email,newUserData.password);
        }
        catch(err){}
        delete newUserData.password
        delete newUserData.conpasswd
        newUserData.isFirstTime=true;
        await setDoc(doc(db,'learners',newUserData.email),newUserData).then(()=>alert("Registration Successful"))
        redirect('/dashboard')




    }


    return(
        <>
        <div className="main-container">
        <div className="motivation-section">
            <div className="carousel-container">
                <div className="carousel-track">
                    <div className="carousel-slide active">
                        {carousel_html[index].props.children}    
                    </div>
                </div>
                
                <div className="carousel-indicators">
                    <div className="indicator" data-slide="0"></div>
                    <div className="indicator" data-slide="1"></div>
                    <div className="indicator" data-slide="2"></div>
                    <div className="indicator" data-slide="3"></div>
                    <div className="indicator" data-slide="4"></div>
                </div>
            </div>
        </div>

        <div className="signup-section">
            <div className={`signup-container ${signupVisibility}`}>
                <div className="signup-header">
                    <h1 className="signup-title">Join the Journey</h1>
                    <p className="signup-subtitle">Transform your potential into success. Start your learning adventure today.</p>
                </div>

                <div className="success-message" id="successMessage">
                    🎉 Welcome aboard! Your journey to success begins now.
                </div>

                <form className="signup-form" onSubmit={handleSubmit}>
                    <div className="form-row">
                        <div className="form-group">
                        <label className="form-label">First Name</label>
                        <input type="text" name="firstName" className="form-input" onChange={handleChange} placeholder="Enter your first name" required />
                        </div>
                        <div className="form-group">
                        <label className="form-label">Last Name</label>
                        <input type="text" name="lastName" className="form-input" onChange={handleChange} placeholder="Enter your last name" required />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input type="email" name="email" className="form-input" onChange={handleChange} placeholder="your.email@example.com" required />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Phone Number</label>
                        <input type="tel" name="phone" className="form-input" onChange={handleChange} placeholder="+91 91234 56789" required />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                        <label className="form-label">Education Level</label>
                        <select name="education" className="form-select" required onChange={handleChange}>
                            <option value="">Select Level</option>
                            <option value="high-school">High School</option>
                            <option value="undergraduate">Undergraduate</option>
                            <option value="graduate">Graduate</option>
                            <option value="professional">Professional</option>
                        </select>
                        </div>
                        <div className="form-group">
                        <label className="form-label">Field of Interest</label>
                        <select name="interest" className="form-select" required onChange={handleChange}>
                            <option value="">Choose Field</option>
                            <option value="technology">Technology</option>
                            <option value="business">Business</option>
                            <option value="design">Design</option>
                            <option value="science">Science</option>
                            <option value="arts">Arts</option>
                            <option value="other">Other</option>
                        </select>
                        </div>
                    </div>

                    <div className="checkbox-group">
                        <input type="checkbox" name="acceptedTerms" className="checkbox" id="terms" required />
                        <label className="checkbox-label">
                        I agree to the <a href="../terms.html">Terms of Service</a> and
                        <a href="../pp.html">Privacy Policy</a>. I'm ready to embark on my learning journey.
                        </label>
                    </div>

                    <div className="checkbox-group">
                        <input type="checkbox" name="newsletter" className="checkbox" id="newsletter" />
                        <label className="checkbox-label">
                        Send me motivational content and learning tips to keep me inspired on my journey.
                        </label>
                    </div>

                    <button type="submit" className="signup-btn">Register</button>
                    </form>
                    

                
                <div className="login-link">
                    Already have an account? <a href="/login/">Sign in here</a>
                </div>
            </div>
            <div className={`signup-container ${pwdVisibility}`}>
                <div className="signup-header">
                    <h1 className="signup-title">Welcome,</h1>
                    <p className="signup-title">{Name}</p>
                    <p className="signup-subtitle">{email}</p>

                </div>

                <form  className={`signup-form`} id="passwordcon" onSubmit={handlePwdSubmit}>
                    
                    <div className="form-group">
                        <label className="form-label" >Password</label>
                        <input type="password" name="password" className="form-input" required onChange={handleChange}/>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Confirm Password</label>
                        <input type="password" name="conpasswd" className="form-input" required onChange={handleChange}/>
                    </div>
                    <button type="submit" className="signup-btn">Create Account</button>
        
                </form>

            </div>
        </div>
        </div>
        </>
    )
}