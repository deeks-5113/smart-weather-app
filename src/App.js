import React, { useState } from 'react';
import './App.css'; // This line imports the styles from App.css

// API keys are now loaded from environment variables
const OPENWEATHER_API_KEY = process.env.REACT_APP_OPENWEATHER_API_KEY;
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;

function App() {
  const [query, setQuery] = useState('');
  const [weatherData, setWeatherData] = useState(null);
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Define the tool schema for OpenAI to understand and call
  const tools = [
    {
      type: "function",
      function: {
        name: "get_current_weather",
        description: "Get the current weather for a specific city. Returns temperature in Celsius, description, humidity, and wind speed.",
        parameters: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "The city name, e.g., 'London', 'New York'",
            },
          },
          required: ["city"],
        },
      },
    },
  ];

  // Simulates an MCP Server's tool for fetching weather data
  const fetchWeatherFromMcpServer = async (targetCity) => {
    if (!OPENWEATHER_API_KEY) { // Check if key is available
      throw new Error('OpenWeatherMap API key is not configured. Please check your .env file.');
    }

    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${targetCity}&appid=${OPENWEATHER_API_KEY}&units=metric`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`City "${targetCity}" not found.`);
        }
        throw new Error(`Error fetching weather: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        temperature: data.main.temp,
        description: data.weather[0].description,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed,
        cityName: data.name,
      };
    } catch (err) {
      console.error('Error in simulated MCP server tool:', err);
      throw err;
    }
  };

  const handleQuery = async () => {
    setError('');
    setWeatherData(null);
    setAiResponse('');
    setLoading(true);

    if (!query.trim()) {
      setError('Please enter a question or city name.');
      setLoading(false);
      return;
    }

    if (!OPENAI_API_KEY) { // Check if key is available
      setError('OpenAI API key is not configured. Please check your .env file.');
      setLoading(false);
      return;
    }

    try {
      // Step 1: Send user query to OpenAI with tool definitions
      const initialOpenAIResponse = await callOpenAI(query, tools);

      const message = initialOpenAIResponse.choices[0].message;

      // Step 2: Check if OpenAI wants to call a tool
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        if (functionName === "get_current_weather") {
          const cityFromAi = functionArgs.city;
          // Execute the simulated MCP server tool
          const weatherResult = await fetchWeatherFromMcpServer(cityFromAi);
          setWeatherData(weatherResult); // Store raw weather data

          // Step 3: Send tool output back to OpenAI for a natural language response
          const finalOpenAIResponse = await callOpenAI(
            query,
            tools,
            [
              { role: "user", content: query },
              message,
              {
                role: "tool",
                tool_call_id: toolCall.id,
                name: functionName,
                content: JSON.stringify(weatherResult),
              },
            ]
          );
          setAiResponse(finalOpenAIResponse.choices[0].message.content);
        } else {
          setAiResponse("OpenAI tried to call an unknown tool.");
        }
      } else {
        // OpenAI provided a direct answer without needing a tool
        setAiResponse(message.content);
      }
    } catch (err) {
      console.error('Error during OpenAI interaction:', err);
      setError(err.message || 'Failed to get a response from AI.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to call OpenAI API
  const callOpenAI = async (userMessage, availableTools, conversationHistory = []) => {
    const messages = [
      {
        role: "system",
        content: "You are a helpful weather assistant. Use the available tools to provide accurate weather information. If a city is mentioned explicitly, try to use the weather tool. Otherwise, answer generalized questions about weather.",
      },
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];

    const payload = {
      model: "gpt-3.5-turbo",
      messages: messages,
      tools: availableTools,
      tool_choice: "auto",
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error.message || response.statusText}`);
    }

    return response.json();
  };

  return (
    <div className="app-container">
      <div className="card">
        <h1 className="card-title">Smart Weather App 🧠🌤️</h1>

        <div className="input-section">
          <input
            type="text"
            className="input-field"
            placeholder="Ask about weather, e.g., 'What's the weather in London?'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleQuery();
              }
            }}
          />
          <button
            onClick={handleQuery}
            className="button"
            disabled={loading}
          >
            {loading ? 'Thinking...' : 'Ask AI'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {aiResponse && (
          <div className="ai-response-box fade-in">
            <h2 className="response-title">AI's Response:</h2>
            <p>{aiResponse}</p>
          </div>
        )}

        {weatherData && (
          <div className="weather-details-box fade-in">
            <h2 className="weather-details-title">
              {weatherData.cityName} Weather Details
            </h2>
            <div className="weather-grid">
              <div className="weather-item">
                <span className="icon">🌡️</span>
                <span className="label">Temperature:</span> {weatherData.temperature}°C
              </div>
              <div className="weather-item">
                <span className="icon">📝</span>
                <span className="label">Description:</span> {weatherData.description}
              </div>
              <div className="weather-item">
                <span className="icon">💧</span>
                <span className="label">Humidity:</span> {weatherData.humidity}%
              </div>
              <div className="weather-item">
                <span className="icon">💨</span>
                <span className="label">Wind Speed:</span> {weatherData.windSpeed} m/s
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
