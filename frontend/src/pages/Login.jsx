import {useState,useEffect} from 'react'
import '../App.css'
import './login.css'
import { auth } from '../firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'
export default function Login() {
    let [index,changeIndexTo]=useState(0);
    let [email, setEmail] = useState('')
    let [password, setPassword] = useState('')
    let [showPassword, setShowPassword] = useState(false)
    let [loading, setLoading] = useState(false)
    let [success, setSuccess] = useState(false)
    let [error, setError] = useState('')

  let carousel_html=[
     <div className="carousel-slide">
          <div className="slide-icon">📚</div>
          <div className="slide-title">Interactive Learning</div>
          <div className="slide-description">Engage with dynamic content, quizzes, and hands-on exercises designed to accelerate your learning journey.</div>
      </div>,
      
      <div className="carousel-slide">
          <div className="slide-icon">👥</div>
          <div className="slide-title">Expert Mentorship</div>
          <div className="slide-description">Learn directly from industry professionals with personalized guidance and real-world insights.</div>
      </div>
      ,
      <div className="carousel-slide">
          <div className="slide-icon">📈</div>
          <div className="slide-title">Progress Tracking</div>
          <div className="slide-description">Monitor your growth with detailed analytics, achievements, and milestone celebrations.</div>
      </div>
      ,
      <div className="carousel-slide">
          <div className="slide-icon">🎯</div>
          <div className="slide-title">Personalized Path</div>
          <div className="slide-description">AI-powered learning recommendations tailored to your goals, pace, and learning style.</div>
      </div>

      ,
        <div className="carousel-slide">
            <div className="slide-icon">🏆</div>
            <div className="slide-title">Career Success</div>
            <div className="slide-description">Build portfolio projects, gain certifications, and connect with opportunities that advance your career.</div>
        </div>
      
      ,
        <div className="carousel-slide">
            <div className="slide-icon">🌐</div>
            <div className="slide-title">Global Community</div>
            <div className="slide-description">Join thousands of learners worldwide, collaborate on projects, and build lasting professional networks.</div>
        </div>
      
      

  ]
    setTimeout(()=>{changeIndexTo((index+1)%carousel_html.length)},5000)
  useEffect(()=>{
    let currbox=document.querySelectorAll(`.indicator`)
    for (let radios of currbox){
        if (radios.getAttribute("data-slide")==index){
            radios.classList.add("active")

        }else{
             radios.classList.remove("active")
        }
    }
  },[index])

    async function handleSubmit(e){
        e.preventDefault()
        setLoading(true)
        setError('')
        // basic client-side validation to avoid sending bad requests
        if (!email || !email.trim()){
            setError('Please enter your email address')
            setLoading(false)
            return
        }
        const emailRegex = /^\S+@\S+\.\S+$/
        if (!emailRegex.test(email)){
            setError('Please enter a valid email address')
            setLoading(false)
            return
        }
        if (!password){
            setError('Please enter your password')
            setLoading(false)
            return
        }

        try{
            await signInWithEmailAndPassword(auth,email,password)
            setSuccess(true)
            setLoading(false)
            setTimeout(()=>{
                window.location.href = '/dashboard'
            },1200)
        }catch(err){
            console.error('Firebase sign-in error', err)
            // Prefer user-friendly messages based on Firebase error codes
            const code = err?.code || ''
            let message = 'Invalid credentials. Please try again.'
            if (code.includes('wrong-password')) message = 'Incorrect password.'
            else if (code.includes('user-not-found')) message = 'No account found with this email.'
            else if (code.includes('invalid-email')) message = 'Invalid email address.'
            else if (code.includes('too-many-requests')) message = 'Too many failed attempts. Try again later.'
            else if (code.includes('missing-password')) message = 'Please provide a password.'
            else if (err?.message) message = err.message

            setError(message)
            setLoading(false)
        }
    }

  
  return (
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
                    <div className="indicator" data-slide="5"></div>
                </div>
            </div>
        </div>

        <div className="login-section">
            <div className="login-container">
                <div className="login-header">
                    <h1 className="login-title">Welcome Back</h1>
                    <p className="login-subtitle">Continue your journey to success. Your progress is waiting for you.</p>
                </div>

                                {success && (
                                    <div className="success-message" id="successMessage">
                                        🎉 Login successful! Redirecting to your dashboard...
                                    </div>
                                )}

                                {error && (
                                    <div className="error-message" id="errorMessage">
                                        ❌ {error}
                                    </div>
                                )}

                                <form className="login-form" id="loginForm" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                                                <input type="email" className="form-input" placeholder="your.email@example.com" required value={email} onChange={e=>setEmail(e.target.value)}/>
                    </div>
                    
                    <div className="form-group">
                        <label className="form-label">Password</label>
                                                <div className="password-group">
                                                        <input type={showPassword?"text":"password"} className="form-input" id="password" placeholder="Enter your password" required value={password} onChange={e=>setPassword(e.target.value)}/>
                                                        <button type="button" className="password-toggle" id="togglePassword" onClick={()=>setShowPassword(s=>!s)}>{showPassword? '🙈' : '👁️'}</button>
                                                </div>
                    </div>
                    
                    <div className="form-options">
                        <div className="remember-group">
                            <input type="checkbox" className="checkbox" id="remember"/>
                            <label className="remember-label">Remember me</label>
                        </div>
                        <a href="#" className="forgot-link">Forgot password?</a>
                    </div>
                    
                    <button type="submit" className="login-btn">{loading? 'Signing in...' : 'Continue My Journey'}</button>
                </form>

                <div className="divider">
                    <span>or continue with</span>
                </div>

                <div className="social-login">
                    <button className="social-btn google" type="button">
                        <span>🔍</span>
                        Continue with Google
                    </button>
                    <button className="social-btn microsoft" type="button">
                        <span>🪟</span>
                        Continue with Microsoft
                    </button>
                </div>
                
                <div className="signup-link">
                    Don't have an account? <a href="#">Sign up here</a>
                </div>
            </div>
        </div>
    </div>
  );
}