import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';
import { Line } from 'react-chartjs-2';
import { 
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Container, Paper, Typography, Grid } from '@mui/material';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAcgvExvFKBu4ZuB1vC6_scQM9HPEgS9uc",
  authDomain: "aero-23f92.firebaseapp.com",
  databaseURL: "https://aero-23f92-default-rtdb.firebaseio.com",
  projectId: "aero-23f92",
  storageBucket: "aero-23f92.firebasestorage.app",
  messagingSenderId: "54017937236",
  appId: "1:54017937236:web:c42c022667599c7f8382c1",
  measurementId: "G-J2L3MN75TF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function App() {
  const [sensorData, setSensorData] = useState([]);
  const [latestValue, setLatestValue] = useState(null);

  useEffect(() => {
    const sensorRef = ref(database, 'sensor_readings');
    
    onValue(sensorRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert object to array and sort by timestamp
        const dataArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        })).sort((a, b) => a.timestamp - b.timestamp);
        
        setSensorData(dataArray);
        setLatestValue(dataArray[dataArray.length - 1]);
      }
    });
  }, []);

  // Prepare data for chart
  const chartData = {
    labels: sensorData.map(data => new Date(data.timestamp * 1000).toLocaleTimeString()),
    datasets: [
      {
        label: 'Sensor Values',
        data: sensorData.map(data => data.value),
        fill: false,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Sensor Data Over Time'
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography component="h1" variant="h4" color="primary" gutterBottom>
              Sensor Dashboard
            </Typography>
          </Paper>
        </Grid>
        
        {latestValue && (
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
              <Typography component="h2" variant="h6" color="primary" gutterBottom>
                Latest Reading
              </Typography>
              <Typography component="p" variant="h3">
                {latestValue.value}
              </Typography>
              <Typography color="text.secondary" sx={{ flex: 1 }}>
                at {new Date(latestValue.timestamp * 1000).toLocaleString()}
              </Typography>
            </Paper>
          </Grid>
        )}
        
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 400 }}>
            <Line data={chartData} options={chartOptions} />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default App; 