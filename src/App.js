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
    console.log('Setting up Firebase listeners...');
    
    // Listen to sensor readings (last 50 entries)
    const readingsRef = query(
      ref(database, 'sensor_readings'),
      orderByChild('timestamp'),
      limitToLast(50)
    );

    const unsubscribeReadings = onValue(readingsRef, (snapshot) => {
      const data = snapshot.val();
      console.log('Received sensor data:', data);
      
      if (data) {
        const dataArray = Object.entries(data)
          .map(([key, value]) => ({
            id: key,
            ...value,
            // Convert string values back to numbers
            temperature: parseFloat(value.temperature),
            humidity: parseFloat(value.humidity),
            vpd: parseFloat(value.vpd),
            ph: parseFloat(value.ph),
            waterLevel: parseFloat(value.waterLevel),
            reservoirVolume: parseFloat(value.reservoirVolume),
            timestamp: parseInt(value.timestamp)
          }))
          .filter(reading => !isNaN(reading.temperature)) // Filter out invalid readings
          .sort((a, b) => a.timestamp - b.timestamp);
        
        console.log('Processed data array:', dataArray);
        setSensorData(dataArray);
        if (dataArray.length > 0) {
          setLatestReading(dataArray[dataArray.length - 1]);
        }
      } else {
        console.log('No sensor data available');
      }
    }, (error) => {
      console.error('Error reading sensor data:', error);
    });

    // Listen to system status
    const statusRef = ref(database, 'system_status');
    const unsubscribeStatus = onValue(statusRef, (snapshot) => {
      const status = snapshot.val();
      console.log('Received system status:', status);
      if (status) {
        setSystemStatus(status);
      }
    }, (error) => {
      console.error('Error reading system status:', error);
    });

    return () => {
      unsubscribeReadings();
      unsubscribeStatus();
    };
  }, []);

  // Add data validation before preparing chart data
  const chartData = {
    labels: sensorData.map(data => 
      data.timestamp ? new Date(data.timestamp * 1000).toLocaleTimeString() : ''
    ),
    datasets: [
      {
        label: 'Temperature (°C)',
        data: sensorData.map(data => data.temperature || null),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1
      },
      {
        label: 'Humidity (%)',
        data: sensorData.map(data => data.humidity || null),
        borderColor: 'rgb(53, 162, 235)',
        tension: 0.1
      },
      {
        label: 'VPD (kPa)',
        data: sensorData.map(data => data.vpd || null),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      },
      {
        label: 'pH',
        data: sensorData.map(data => data.ph || null),
        borderColor: 'rgb(153, 102, 255)',
        tension: 0.1
      }
    ]
  };

  // Improve number formatting with validation
  const formatNumber = (value, decimals = 1) => {
    if (value === undefined || value === null || isNaN(value)) {
      return 'N/A';
    }
    const num = parseFloat(value);
    return isFinite(num) ? num.toFixed(decimals) : 'N/A';
  };

  // Add loading state
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography>Loading sensor data...</Typography>
      </Container>
    );
  }

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
                System Status: {systemStatus.status || 'Unknown'} 
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
                  {formatNumber(latestReading.temperature)}°C
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
                <Typography component="h2" variant="h6" color="primary" gutterBottom>
                  Humidity
                </Typography>
                <Typography component="p" variant="h3">
                  {formatNumber(latestReading.humidity)}%
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
                <Typography component="h2" variant="h6" color="primary" gutterBottom>
                  pH Level
                </Typography>
                <Typography component="p" variant="h3">
                  {formatNumber(latestReading.ph, 2)}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={3}>
              <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
                <Typography component="h2" variant="h6" color="primary" gutterBottom>
                  Water Level
                </Typography>
                <Typography component="p" variant="h3">
                  {formatNumber(latestReading.waterLevel)}cm
                </Typography>
              </Paper>
            </Grid>
          </>
        )}

        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 400 }}>
            <Line 
              data={chartData} 
              options={chartOptions} 
              fallback={<Typography>Loading chart data...</Typography>}
            />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default App; 