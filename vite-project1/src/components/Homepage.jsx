import  { useRef, useState, useCallback } from 'react';
import Particles from 'react-tsparticles';
import { loadFull } from 'tsparticles';
import Lottie from 'lottie-react';
import myAnimation from '../animations/DataAnalysis.json';
import './Homepage.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBrain, faFileCsv,
  faUpload,
  faTimes,
  faChartBar,
  faExclamationCircle,
  faSpinner,
  faCheck,
  faChartLine,
  faCheckCircle,
  faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { Navbar } from '../navbar/Navbar';




const Homepage = () => {
   const particlesInit = useCallback(async engine => {
    await loadFull(engine);
  }, []);
  const fileInputRef = useRef(null); 
  const [selectedFile, setSelectedFile] = useState(null);
  const [isFileSelected, setIsFileSelected] = useState(false);
  const [analyzeButtonDisabled, setAnalyzeButtonDisabled] = useState(true);
  const [filePreviewVisible, setFilePreviewVisible] = useState(false);
  const [errorMessageVisible, setErrorMessageVisible] = useState(false);
  const [errorMessageText, setErrorMessageText] = useState('');
  const [progressContainerVisible, setProgressContainerVisible] = useState(false);
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const [progressMessageText, setProgressMessageText] = useState('Initializing analysis...');
  const [progressPercentageValue, setProgressPercentageValue] = useState(0);
  const [resultContainerVisible, setResultContainerVisible] = useState(false);
  const [reportUrl, setReportUrl] = useState('#');
  const [partialResultsVisible, setPartialResultsVisible] = useState(false);
  const [kpiResults, setKpiResults] = useState({});
  
  const steps = {
    upload: useRef(null),
    analysis: useRef(null),
    visualization: useRef(null),
    report: useRef(null),
  };
  const currentStep = useRef('upload');
  const previousProgress = useRef(0);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setIsFileSelected(true);
      setFilePreviewVisible(true);
      setAnalyzeButtonDisabled(false);
      setErrorMessageVisible(false);
    } else {
      resetFileSelection();
    }
  };

  const resetFileSelection = () => {
    setSelectedFile(null);
    setIsFileSelected(false);
    setFilePreviewVisible(false);
    setAnalyzeButtonDisabled(true);
  };

  const handleRemoveFile = (event) => {
    event.preventDefault();
    resetFileSelection();
  };

  const preventDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const highlight = () => {
    const fileUploadLabel = document.querySelector('.file-upload');
    if (fileUploadLabel) {
      fileUploadLabel.classList.add('highlight');
    }
  };

  const unhighlight = () => {
    const fileUploadLabel = document.querySelector('.file-upload');
    if (fileUploadLabel) {
      fileUploadLabel.classList.remove('highlight');
    }
  };

  const handleDrop = (event) => {
    const dt = event.dataTransfer;
    const files = dt.files;
    if (fileInputRef.current) {
      fileInputRef.current.files = files;
      handleFileSelect({ target: fileInputRef.current });
    }
  };

  const handleFileButtonClick = (e) => {
    e.stopPropagation();
    fileInputRef.current && fileInputRef.current.click();
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      showError('Please select a file to upload');
      return;
    }
    

    const formData = new FormData();
    formData.append('file', selectedFile);

    setAnalyzeButtonDisabled(true);
    const analyzeButtonElement = document.getElementById('analyzeButton');
    if (analyzeButtonElement) {
      analyzeButtonElement.innerHTML = `<FontAwesomeIcon icon={faSpinner} spin /> Analyzing...`;
    }
    setErrorMessageVisible(false);

    try {
      const response = await fetch('https://deepanalysis.azurewebsites.net/analyze/', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error uploading file');
      }

      const data = await response.json();

      const uploadFormElement = document.getElementById('uploadForm');
      if (uploadFormElement) {
        uploadFormElement.style.display = 'none';
      }
      setProgressContainerVisible(true);

      if (steps.upload.current) {
        steps.upload.current.classList.add('completed');
      }

      pollTaskStatus(data.task_id);
    } catch (error) {
      console.error('Error:', error);
      setAnalyzeButtonDisabled(false);
      if (analyzeButtonElement) {
        analyzeButtonElement.innerHTML = `<FontAwesomeIcon icon={faChartBar} /> Analyze Data`;
      }
      showError(error.message || 'Error uploading file. Please try again.');
    }
  };

  const updateSteps = (progress) => {
    let newStep = currentStep.current;

    if (progress >= 0.9) newStep = 'report';
    else if (progress >= 0.6) newStep = 'visualization';
    else if (progress >= 0.3) newStep = 'analysis';
  

    if (newStep !== currentStep.current) {
      if (steps[currentStep.current] && steps[currentStep.current].current) {
        steps[currentStep.current].current.classList.add('completed');
      }
      if (steps[newStep] && steps[newStep].current) {
        steps[newStep].current.classList.add('active');
      }
      currentStep.current = newStep;
    }
  };

  const pollTaskStatus = async (taskId) => {
    let complete = false;

    while (!complete) {
      try {
        const response = await fetch(`https://deepanalysis.azurewebsites.net/task/${taskId}`);

        if (!response.ok) {
          throw new Error('Error checking task status');
        }

        const data = await response.json();
        const progress = data.progress;
        const progressPercentValue = Math.round(progress * 100);

        if (progress > previousProgress.current) {
          setProgressBarWidth(progressPercentValue);
          setProgressPercentageValue(progressPercentValue);
          setProgressMessageText(data.message);
          previousProgress.current = progress;
          updateSteps(progress);
        }

        if (data.partial_results) {
          setPartialResultsVisible(true);
          setKpiResults(data.partial_results);
        }

        if (data.status === 'completed') {
          complete = true;
          Object.values(steps).forEach((step) => {
            if (step.current) {
              step.current.classList.add('completed');
              step.current.classList.remove('active'); 
            }
          });
          setProgressContainerVisible(false);
          setResultContainerVisible(true);
          setReportUrl(data.report_url); 
        } else if (data.status === 'failed') {
          complete = true;
          setProgressContainerVisible(false);
          showError(`Analysis failed: ${data.message}`);
          const uploadFormElement = document.getElementById('uploadForm');
          const analyzeButtonElement = document.getElementById('analyzeButton');
          if (uploadFormElement) {
            uploadFormElement.style.display = 'block';
          }
          setAnalyzeButtonDisabled(false);
          if (analyzeButtonElement) {
            analyzeButtonElement.innerHTML = `<FontAwesomeIcon icon={faChartBar} /> Analyze Data`;
          }
        }

        if (!complete) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error('Error polling status:', error);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  };

  const showError = (message) => {
    setErrorMessageText(message);
    setErrorMessageVisible(true);
    const errorMessageElement = document.getElementById('errorMessage');
    if (errorMessageElement) {
      errorMessageElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
    
    <Navbar/>
    <Particles
        id="tsparticles"
        init={particlesInit}
        options={{  
         fullScreen: { enable: true, zIndex: -1 }, 
          background: { color: { value: "#000" } },
          fpsLimit: 60,
          interactivity: {
            detectsOn: "canvas",
            events: {
              onHover: { enable: true, mode: "grab" },
              onClick: { enable: true, mode: "push" },
              resize: true
            },
            modes: {
              grab: { distance: 200, links: { opacity: 0.5 } },
              push: { quantity: 4 }
            }
          },
          particles: {
            number: { value: 60, density: { enable: true, area: 800 } },
            color: { value: "#ffffff" },
            shape: { type: "circle" },
            opacity: { value: 0.4 },
            size: { value: { min: 1, max: 3 }, random: true },
            links: {
              enable: true,
              distance: 150,
              color: "#ffffff",
              opacity: 0.3,
              width: 1
            },
            move: {
              enable: true,
              speed: 2,
              outModes: { default: "bounce" }
            }
          },
          detectRetina: true
        }}
      />
      <section className="hero-section">
      
        <div className="container">
          <div className="tagline">Building agents for structured data</div>
          <h1 className="main-title">
            <span className="highlight">Deep Analysis</span> that transforms data into insights
          </h1>
         <div className='lottie-file'>
      <Lottie animationData={myAnimation} loop={true} />
          <p className="description">
          
      
            Deep Analysis is a powerful automated data analysis service designed to streamline the process of extracting insights from structured data. Using a system of intelligent agents powered by AI, it automatically explores CSV files, identifies key performance indicators (KPIs), generates visualizations, and produces comprehensive analytical reports.
           <br/>
           <br/>
            We use internal AI agents to work with all kinds of structured data, requiring 0 human intervention throughout the entire analysis process.
          </p>
          </div>
        </div>
        
      </section>
      <section className="upload-section">
        <div className="container">
       
          <form id="uploadForm" className="upload-container" onSubmit={handleSubmit}>
          <h2 className="upload-title">Start Your Analysis</h2>
          <p className="upload-subtitle">Upload your CSV file and let our AI agents do the magic</p>
          <label htmlFor="fileInput" className="file-upload" onDragEnter={preventDefaults}  onDragOver={(event) => {
            preventDefaults(event);
            highlight();
          }} onDragLeave={unhighlight} onDrop={handleDrop}>
            <div className="file-icon">
                <FontAwesomeIcon icon={faFileCsv} style={{ color: 'var(--primary)', fontSize: '24px' }} />
              </div>
              <h3 className="upload-text">Drag & Drop Your CSV File Here</h3>
              <p className="format-text">Supported formats: CSV</p>
              
             <br/>
             <button className="btn-upload" onClick={handleFileButtonClick} type="button">
                <FontAwesomeIcon icon={faUpload} />
                Choose File
              </button>
             </label>
             <input
          ref={fileInputRef}
         type="file"
            id="fileInput"
            accept=".csv"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
         />         
           
            <div className="file-preview" id="filePreview" style={{ display: filePreviewVisible ? 'flex' : 'none' }}>
            <div className="file-icon">
                <FontAwesomeIcon icon={faFileCsv} style={{ color: 'var(--primary)', fontSize: '20px' }}/>
                </div>
                <div className="file-preview-content">
                  <h4>Selected File</h4>
                  <p id="selectedFileName">{selectedFile ? selectedFile.name : 'No file selected'}</p>
                </div>
                <FontAwesomeIcon icon={faTimes} className="remove-file" id="removeFile" onClick={handleRemoveFile} />
              </div>
                <button type="submit" id="analyzeButton" disabled={analyzeButtonDisabled}>
                <FontAwesomeIcon icon={faChartBar} />
                Analyze Data
              </button>
              <p className="info-text">
              This is the AI Agent Report Builder. Our dashboard generator will be shipped next.
            </p>
              </form>
              
            <div className="error-message" id="errorMessage" style={{ display: errorMessageVisible ? 'block' : 'none' }}>
              <FontAwesomeIcon icon={faExclamationCircle} />
              <span id="errorText">{errorMessageText}</span>
            </div>
         

          <div className="progress-container" id="progressContainer" style={{ display: progressContainerVisible ? 'block' : 'none' }}>
            <h3>
              <FontAwesomeIcon icon={faSpinner} spin />
              Analysis in Progress
            </h3>

            <div className="progress-bar-container">
              <div className="progress-bar" id="progressBar" style={{ width: `${progressBarWidth}%` }}></div>
            </div>

            <div className="progress-status">
              <div className="progress-message" id="progressMessage">{progressMessageText}</div>
              <div className="progress-percentage" id="progressPercentage">{progressPercentageValue}%</div>
            </div>

            <div className="steps-container">
              <div className={`step active`} id="stepUpload" ref={steps.upload}>
                <div className="step-icon">
                  <FontAwesomeIcon icon={faCheck} />
                </div>
                <div className="step-content">
                  <div className="step-title">File Upload</div>
                  <div className="step-description">CSV file uploaded successfully</div>
                </div>
              </div>

              <div className={`step`} id="stepAnalysis" ref={steps.analysis}>
                <div className="step-icon">
                  <FontAwesomeIcon icon={faCheck} />
                </div>
                <div className="step-content">
                  <div className="step-title">Analysis</div>
                  <div className="step-description">Performing data analysis</div>
                </div>
              </div>

              <div className={`step`} id="stepVisualization" ref={steps.visualization}>
                <div className="step-icon">
                  <FontAwesomeIcon icon={faCheck} />
                </div>
                <div className="step-content">
                  <div className="step-title">Visualization</div>
                  <div className="step-description">Creating data visualizations</div>
                </div>
              </div>

              <div className={`step`} id="stepReport" ref={steps.report}>
                <div className="step-icon">
                  <FontAwesomeIcon icon={faCheck} />
                </div>
                <div className="step-content">
                  <div className="step-title">Report Generation</div>
                  <div className="step-description">Generating final analysis report</div>
                </div>
              </div>
            </div>

            <div className="partial-results" id="partialResults" style={{ marginTop: '30px', display: partialResultsVisible ? 'block' : 'none' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '600', marginBottom: '20px', color: 'var(--dark)' }}>
                <FontAwesomeIcon icon={faChartLine} style={{ color: 'var(--success)' }} />
                Preliminary Results
              </h3>
              <div className="kpi-results-container" id="kpiResultsContainer">
                {Object.entries(kpiResults).map(([kpiName, kpiData]) => (
                  <div key={kpiName} className="kpi-result-card" style={{ background: 'white', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.06)', padding: '20px', marginBottom: '20px', animation: 'fadeIn 0.5s ease' }}>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '15px', color: 'var(--primary)', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>{kpiName}</h4>
                    {kpiData.visualization_url && (
                      <div className="visualization-container" style={{ marginBottom: '15px', textAlign: 'center' }}>
                        <img src={kpiData.visualization_url} alt={`Visualization for ${kpiName}`} style={{ maxWidth: '100%', height: 'auto', borderRadius: '6px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }} />
                      </div>
                    )}
                    {kpiData.insights && (
                      <div className="insights-container" style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', fontSize: '0.95rem' }} dangerouslySetInnerHTML={{ __html: kpiData.insights }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="result-container" id="resultContainer" style={{ display: resultContainerVisible ? 'block' : 'none' }}>
            <FontAwesomeIcon icon={faCheckCircle} />
            <h3>Analysis Complete!</h3>
            <p>Your comprehensive data analysis report is ready. <br/>View the report to discover valuable insights into your data.</p>
            <a href={reportUrl} className="btn-result" id="viewReportBtn" target="_blank" rel="noopener noreferrer">
              <FontAwesomeIcon icon={faExternalLinkAlt} />
              View Full Report
            </a>
          </div>
        </div>
       
      </section>
      <footer>
        <div className="container footer-content">
          <div className="footer-logo">
            <FontAwesomeIcon icon={faBrain} className="footer-logo-icon" />
            <div className="footer-logo-text">Deep Analysis</div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Homepage;