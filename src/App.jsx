import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const messages = [
  "Analyzing samosa geometry...",
  "Evaluating crispiness patterns...",
  "Consulting with AI food experts...",
];

// Helper function to convert file to base64
const getImageData = async (file) => {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Invalid file type. Please upload an image file.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        const base64Data = reader.result.split(',')[1];
        if (!base64Data) {
          reject(new Error('Failed to convert image to base64'));
          return;
        }
        resolve(base64Data);
      } catch (error) {
        reject(new Error('Error processing image: ' + error.message));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsDataURL(file);
  });
};

export default function SamosaSharpnessAnalyzer() {
  const [image, setImage] = useState(null);
  const [step, setStep] = useState("upload");
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [score, setScore] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  // Helper function to handle Gemini API response
  const processGeminiResponse = (responseText) => {
    try {
      // Check if it's a non-samosa response
      if (responseText.toLowerCase().includes("sorry") || 
          responseText.toLowerCase().includes("unable to")) {
        throw new Error("No samosa detected in the image. Please upload a clear image of a samosa.");
      }

      // Try to extract JSON from the response
      const jsonRegex = /\{[\s\S]*\}/;
      const jsonMatch = responseText.match(jsonRegex);
      
      if (!jsonMatch) {
        throw new Error("Could not get a proper analysis. Please try with a clearer image of a samosa.");
      }

      const analysisData = JSON.parse(jsonMatch[0]);
      
      if (!analysisData || !analysisData.score || !analysisData.corners) {
        throw new Error("Invalid analysis format. Please try again with a different image.");
      }

      return analysisData;
    } catch (error) {
      if (error.message.includes('JSON')) {
        throw new Error("Could not analyze the image properly. Please try with a different image.");
      }
      throw error;
    }
  };

  // Main analysis function
  const analyzeImage = async (imageData) => {
    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generation_config: {
          temperature: 0.2,
          topP: 0.8,
          topK: 16,
          maxOutputTokens: 1024
        }
      });
      
      const prompt = `Analyze this samosa image and provide:
      1. A score out of 100 based on its visual appearance
      2. Analysis of its three corners in degrees (estimate)
      3. A brief comment about each corner's crispiness
      Format the response as a JSON object with score, corners array (each with name, angle, and comment).
      Example format: {"score": 85, "corners": [{"name": "Top", "angle": 60, "comment": "Crispy"}]}`;

      console.log('Sending request to Gemini API...');
      const result = await model.generateContent([
        {
          text: prompt
        },
        {
          inlineData: {
            data: imageData,
            mimeType: "image/jpeg"
          }
        }
      ]);

      if (!result) {
        throw new Error('No response from Gemini API');
      }

      console.log('Got response from Gemini API');
      const response = await result.response;
      const responseText = response.text();
      console.log('Raw response:', responseText);

      // Process and validate the response
      const analysisData = processGeminiResponse(responseText);
      setScore(analysisData.score);
      setAnalysis(analysisData);
      return analysisData;
    } catch (error) {
      console.error("Error analyzing image:", error);
      throw error;
    }
  };

  // Effect for cycling through loading messages
  useEffect(() => {
    if (step === "analyzing") {
      const interval = setInterval(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [step]);

  // Handle image upload and analysis
  async function onImageChange(e) {
    const file = e.target.files[0];
    if (file) {
      setImage(URL.createObjectURL(file));
      setStep("analyzing");
      setCurrentMessageIndex(0);
      setScore(null);
      setAnalysis(null);

      try {
        const imageData = await getImageData(file);
        await analyzeImage(imageData);
        setStep("result");
      } catch (error) {
        console.error("Error processing image:", error);
        alert(error.message || "Error processing image. Please try again with a different image.");
        setStep("upload");
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-100 via-yellow-200 to-yellow-300 flex flex-col items-center justify-center p-4 font-sans">
      <h1 className="text-4xl font-bold mb-6 text-yellow-900 drop-shadow-md">
        Samosa Sharpness Analyzer
      </h1>
      <p className="mb-8 italic text-yellow-800">
        Because geometry tastes better with chai.
      </p>

      {step === "upload" && (
        <div className="flex flex-col items-center space-y-4">
          <label
            htmlFor="upload"
            className="cursor-pointer bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-6 rounded shadow"
          >
            Upload Your Samosa Photo 🍽️
          </label>
          <input
            type="file"
            id="upload"
            accept="image/*"
            className="hidden"
            onChange={onImageChange}
          />
        </div>
      )}

      {(step === "analyzing" || step === "result") && image && (
        <img
          src={image}
          alt="Uploaded samosa"
          className="w-64 h-64 object-cover rounded-lg shadow-lg mb-6 border-4 border-yellow-600"
        />
      )}

      {step === "analyzing" && (
        <div className="text-yellow-900 font-mono text-xl animate-pulse">
          {messages[currentMessageIndex]}
        </div>
      )}

      {step === "result" && analysis && (
        <div className="bg-yellow-200 rounded-lg p-6 w-80 shadow-lg border-2 border-yellow-400">
          <h2 className="text-2xl font-bold mb-4 text-yellow-900">
            AI Analysis Results
          </h2>
          <ul className="space-y-2 mb-6">
            {analysis.corners.map(({ name, angle, comment }) => (
              <li
                key={name}
                className="text-yellow-900 font-semibold flex justify-between"
              >
                <span>{name}:</span>
                <span>
                  {angle}° – <span>{comment}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="text-center font-extrabold text-yellow-900 text-3xl">
            Triangle Perfection Score:{" "}
            <span className="text-yellow-600">{score} / 100</span>
          </div>
          <button
            onClick={() => setStep("upload")}
            className="mt-6 bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded"
          >
            Analyze Another Samosa
          </button>
        </div>
      )}
    </div>
  );
}