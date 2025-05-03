import fetch from 'node-fetch';

async function testTTSAPI() {
  const TTS_API_URL = 'https://flask-api-955132768795.us-central1.run.app/api/tts/generate-audio';
  
  const payload = {
    text: "This is a test message for the TTS API",
    voices: ["R", "S"],
    position: [1, 0],
    author_name: "Mariana Tiengo",
    author_id: "odsadddddddds",
    description: "blrioda2331312333sodasodjfiosjffasdasdsa",
    podcast_title: "Mariana by Mariana",
    author_description: "",
    content_type: "",
    type: 0,
    typeVoice: 0
  };
  
  console.log("Sending payload:", JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch(TTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const responseText = await response.text();
    console.log("Response status:", response.status);
    console.log("Response headers:", response.headers);
    
    try {
      const data = JSON.parse(responseText);
      console.log("Parsed response:", data);
    } catch (e) {
      console.log("Raw response:", responseText);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testTTSAPI();