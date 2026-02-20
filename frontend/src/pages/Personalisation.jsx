import React, { useEffect, useState } from 'react';
import './Personalisation.css';
import {getFirestore, doc, updateDoc, getDoc} from 'firebase/firestore';
import {db,auth} from '../firebase';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';


export default function Personalisation() {
  const router=useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [yearsOfStudy, setYearsOfStudy] = useState(null);
  const [numberOfAttempts, setNumberOfAttempts] = useState(null);
  const [hasCoaching, setHasCoaching] = useState(null);
  const [selectedAcademy, setSelectedAcademy] = useState('');
  const [yearsInAcademy, setYearsInAcademy] = useState(null);
  const [userData,setUserData]=useState(null);
  

  useEffect(() => {
      // Subscribe to auth state changes
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log("Auth state changed:", user);
        setUserData(user);
        
        if (user && user.email) {
          try {
            const docSnap = await getDoc(doc(db, 'learners', user.email));
            console.log(await docSnap.data().isFirstTime,user.email);
            if (docSnap.exists() && !await docSnap.data().isFirstTime) {
              router('/dashboard');
            }
          } catch (error) {
            console.error("Error checking user document:", error);
          }
        }
      });

      // Cleanup subscription on unmount
      return () => unsubscribe();
    }, []); // Remove userData from dependencies to avoid infinite loops

  const totalSteps = hasCoaching === 'yes' ? 5 : 3;
  const progress = currentStep==1?0:((currentStep-1) / totalSteps) * 100;

  const studyYears = [
    { id: '0-1', label: 'Less than 1 year', value: '0-1', maxAttempts: 1 },
    { id: '1-2', label: '1-2 years', value: '1-2', maxAttempts: 2 },
    { id: '2-3', label: '2-3 years', value: '2-3', maxAttempts: 3 },
    { id: '3-4', label: '3-4 years', value: '3-4', maxAttempts: 4 },
    { id: '4+', label: '4+ years', value: '4+', maxAttempts: 6 }
  ];

  const attempts = [
    { id: '0', label: 'First Attempt', value: '0' },
    { id: '1', label: '1 Attempt', value: '1' },
    { id: '2', label: '2 Attempts', value: '2' },
    { id: '3', label: '3 Attempts', value: '3' },
    { id: '4', label: '4 Attempts', value: '4' },
    { id: '5+', label: '5+ Attempts', value: '5+' }
  ];

  const getMaxAttempts = () => {
    const selectedYear = studyYears.find(y => y.value === yearsOfStudy);
    return selectedYear ? selectedYear.maxAttempts : 6;
  };

  const isAttemptDisabled = (attemptValue) => {
    const maxAttempts = getMaxAttempts();
    const attemptNum = attemptValue === '5+' ? 5 : parseInt(attemptValue);
    return attemptNum > maxAttempts;
  };

  const handleContinue = async () => {

    if (currentStep > totalSteps) {
      updateDoc(doc(db, "learners", auth.currentUser.email),{
        yearsOfStudy: yearsOfStudy,
        numberOfAttempts: numberOfAttempts,
        hasCoaching: hasCoaching,
        selectedAcademy: selectedAcademy,
        yearsInAcademy: yearsInAcademy,
        isFirstTime:false
      }).then(()=>{
        alert("Personalisation Complete\nRedirecting to Dashboard");
        router('/dashboard');
      
      });
      
    }
    else{
    setCurrentStep(currentStep + 1);

      
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <div className="roles-grid">
          {studyYears.map((year) => (
            <div
              key={year.id}
              className={`role-card ${yearsOfStudy === year.value ? 'selected' : ''}`}
              onClick={() => {
                setYearsOfStudy(year.value);
                setNumberOfAttempts(null); // Reset attempts when years change
              }}
            >
              <h3 className="role-title">{year.label}</h3>
              <div className={`checkmark ${yearsOfStudy === year.value ? 'visible' : ''}`}>
                ✓
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="roles-grid">
          {attempts.map((attempt) => {
            const disabled = isAttemptDisabled(attempt.value);
            return (
              <div
                key={attempt.id}
                className={`role-card ${
                  disabled ? 'disabled' : numberOfAttempts === attempt.value ? 'selected' : ''
                }`}
                onClick={() => !disabled && setNumberOfAttempts(attempt.value)}
                style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
              >
                <h3 className="role-title">{attempt.label}</h3>
                <div className={`checkmark ${!disabled && numberOfAttempts === attempt.value ? 'visible' : ''}`}>
                  ✓
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="roles-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div
            className={`role-card ${hasCoaching === 'yes' ? 'selected' : ''}`}
            onClick={() => setHasCoaching('yes')}
          >
            <h3 className="role-title">Yes</h3>
            <p className="role-description">I have joined a coaching center</p>
            <div className={`checkmark ${hasCoaching === 'yes' ? 'visible' : ''}`}>
              ✓
            </div>
          </div>
          <div
            className={`role-card ${hasCoaching === 'no' ? 'selected' : ''}`}
            onClick={() => setHasCoaching('no')}
          >
            <h3 className="role-title">No</h3>
            <p className="role-description">I am self-studying</p>
            <div className={`checkmark ${hasCoaching === 'no' ? 'visible' : ''}`}>
              ✓
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 4 && hasCoaching === 'yes') {
      return (
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <input
            type="text"
            className="academy-input"
            placeholder="Enter your coaching academy name"
            value={selectedAcademy}
            onChange={(e) => setSelectedAcademy(e.target.value)}
          />
        </div>
      );
    }

    if (currentStep === 5 && hasCoaching === 'yes') {
      return (
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <input
            type="number"
            className="academy-input"
            placeholder="Enter years of training under the academy"
            value={yearsInAcademy || ''}
            onChange={(e) => setYearsInAcademy(e.target.value)}
            min="0"
          />
        </div>
      );
    }
    // Success page - displayed after all questions are completed
    return (
      <div className="success-message" style={{display:'block'}}>
        <h2>Personalisation Complete!</h2>
        <p>Congratulations! You have successfully set up your profile.</p>
        {hasCoaching === 'yes' && (
          <div className="details-summary">
            <h3>Your Details:</h3>
            <ul>
              <li>Years of Preparation: {yearsOfStudy}</li>
              <li>Number of Attempts: {numberOfAttempts}</li>
              <li>Academy: {selectedAcademy}</li>
              <li>Years in Academy: {yearsInAcademy}</li>
            </ul>
          </div>
        )}
        {hasCoaching === 'no' && (
          <div className="details-summary">
            <h3>Your Details:</h3>
            <ul>
              <li>Years of Preparation: {yearsOfStudy}</li>
              <li>Number of Attempts: {numberOfAttempts}</li>
              <li>Study Mode: Self-studying</li>
            </ul>
          </div>
        )}
      </div>
    );
  };

  const getStepTitle = () => {
    if (currentStep === 1) {
      return 'Years of Preparation';
    }
    if (currentStep === 2) {
      return 'Number of Attempts';
    }
    if (currentStep === 3) {
      return 'Coaching Status';
    }
    if (currentStep === 4 && hasCoaching === 'yes') {
      return 'Academy Name';
    }
    if (currentStep === 5 && hasCoaching === 'yes') {
      return 'Training Duration';
    }
    if ((currentStep === 4 && hasCoaching === 'no') || (currentStep === 5 && hasCoaching === 'yes')) {
      return 'Personalisation Complete';
    }
    return 'Next Step';
  };

  const getStepSubtitle = () => {
    if (currentStep === 1) {
      return 'How long have you been preparing for UPSC?';
    }
    if (currentStep === 2) {
      return 'How many attempts have you made?';
    }
    if (currentStep === 3) {
      return 'Have you joined a coaching center?';
    }
    if (currentStep === 4 && hasCoaching === 'yes') {
      return 'Which coaching academy are you enrolled in?';
    }
    if (currentStep === 5 && hasCoaching === 'yes') {
      return 'How long have you been training there?';
    }
    if ((currentStep === 4 && hasCoaching === 'no') || (currentStep === 5 && hasCoaching === 'yes')) {
      return 'Your profile has been set up successfully';
    }
    return 'Continue your setup';
  };

  const isContinueDisabled = () => {
    if (currentStep === 1) return !yearsOfStudy;
    if (currentStep === 2) return !numberOfAttempts;
    if (currentStep === 3) return hasCoaching === null;
    if (currentStep === 4 && hasCoaching === 'yes') return !selectedAcademy.trim();
    if (currentStep === 5 && hasCoaching === 'yes') return !yearsInAcademy;
    if ((currentStep === 4 && hasCoaching === 'no') || (currentStep === 5 && hasCoaching === 'yes')) return false; // Disable at success
    return false;
  };


  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <h1 className="title">{getStepTitle()}</h1>
          <p className="subtitle">{getStepSubtitle()}</p>
        </div>
        
        {currentStep >= 1 && (
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="progress-text" style={{display:currentStep>totalSteps?'none':'block'}}>
              Step {currentStep} of {totalSteps}
            </div>
          </div>
        )}

        {renderStepContent()}

        <div className="button-group">
          <button 
            className="back-button" 
            disabled={currentStep === 1}
            onClick={handleBack}
          >
            ← Back
          </button>
          <button
            className={`continue-button ${!isContinueDisabled() ? 'active' : ''}`}
            disabled={isContinueDisabled()}
            onClick={handleContinue}
          >
            {
              ((currentStep === 4 && hasCoaching === 'no') || (currentStep === 5 && hasCoaching === 'yes')) || currentStep > totalSteps ? 'Finish' : 'Continue →'
            }
          </button>
        </div>
      </div>
    </div>
  );
}