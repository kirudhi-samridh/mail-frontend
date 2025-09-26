// // D:\lmaa_code\packages\frontend\src\index.js
// import React from 'react';
// import ReactDOM from 'react-dom/client';
// import './index.css'; // <--- Make sure this line exists and points to your Tailwind CSS file
// import App from './App';
// import reportWebVitals from './reportWebVitals'; // or remove if not needed

// const root = ReactDOM.createRoot(document.getElementById('root'));
// root.render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>
// );

// // If you want to start measuring performance in your app, pass a function
// // to log results (for example: reportWebVitals(console.log))
// // or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals(); // or remove if not needed

// D:\lmaa_code\packages\frontend\src\index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId="457452182711-i3p81h9k5knvnnohbbk9oufe6hql2o54.apps.googleusercontent.com">
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
