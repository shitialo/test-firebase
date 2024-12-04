import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, query, limitToLast, orderByChild } from 'firebase/database';
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
  const [systemStatus, setSystemStatus] = useState(null);
  const [latestReading, setLatestReading] = useState(null);

  useEffect(() => {
    // Listen to sensor readings (last 50 entries)
    const readingsRef = query(
      ref(database, 'sensor_readings'),
      orderByChild('timestamp'),
      limitToLast(50)
    );

    const unsubscribeReadings = onValue(readingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const dataArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        })).sort((a, b) => a.timestamp - b.timestamp);
        
        setSensorData(dataArray);
        setLatestReading(dataArray[dataArray.length - 1]);
      }
    });

    // Listen to system status
    const statusRef = ref(database, 'system_status');
    const unsubscribeStatus = onValue(statusRef, (snapshot) => {
      const status = snapshot.val();
      if (status) {
        setSystemStatus(status);
      }
    });

    return () => {
      unsubscribeReadings();
      unsubscribeStatus();
    };
  }, []);

  // Prepare data for chart
  const chartData = {
    labels: sensorData.map(data => 
      new Date(data.timestamp * 1000).toLocaleTimeString()
    ),
    datasets: [
      {
        label: 'Temperature (°C)',
        data: sensorData.map(data => data.temperature),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1
      },
      {
        label: 'Humidity (%)',
        data: sensorData.map(data => data.humidity),
        borderColor: 'rgb(53, 162, 235)',
        tension: 0.1
      },
      {
        label: 'VPD (kPa)',
        data: sensorData.map(data => data.vpd),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      },
      {
        label: 'pH',
        data: sensorData.map(data => data.ph),
        borderColor: 'rgb(153, 102, 255)',
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
        beginAtZero: false
      }
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography component="h1" variant="h4" color="primary" gutterBottom>
              Hydroponic System Dashboard
            </Typography>
            {systemStatus && (
              <Typography color="text.secondary">
                System Status: {systemStatus.status} 
                {systemStatus.vpdPumpRunning && " (VPD Pump Active)"}
                {systemStatus.phAdjusting && " (pH Adjusting)"}
              </Typography>
            )}
          </Paper>
        </Grid>

        {latestReading && (
          <>
            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
                <Typography component="h2" variant="h6" color="primary" gutterBottom>
                  Temperature
                </Typography>
                <Typography component="p" variant="h3">
                  {latestReading.temperature.toFixed(1)}°C
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
                <Typography component="h2" variant="h6" color="primary" gutterBottom>
                  Humidity
                </Typography>
                <Typography component="p" variant="h3">
                  {latestReading.humidity.toFixed(1)}%
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
                <Typography component="h2" variant="h6" color="primary" gutterBottom>
                  pH Level
                </Typography>
                <Typography component="p" variant="h3">
                  {latestReading.ph.toFixed(2)}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
                <Typography component="h2" variant="h6" color="primary" gutterBottom>
                  Water Level
                </Typography>
                <Typography component="p" variant="h3">
                  {latestReading.waterLevel.toFixed(1)}cm
                </Typography>
              </Paper>
            </Grid>
          </>
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