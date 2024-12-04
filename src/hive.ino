#include <Wire.h>
#include <math.h>
#include <AccelStepper.h>
#include "Adafruit_SHT31.h"
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <time.h>

// Pin Definitions for ESP32-S3
#define PH_PIN 1          // ADC1_CH0
#define VPD_PUMP_RELAY 19  
#define ACID_PUMP_RELAY 21 
#define BASE_PUMP_RELAY 20 
#define MIX_PUMP_RELAY 5  
#define TRIG_PIN 13        
#define ECHO_PIN 14        
#define LDR_PIN 8        // Changed to ADC1_CH1 for analog reading
#define STEPPER_STEP_PIN 4 
#define STEPPER_DIR_PIN 5  

// WiFi credentials
#define WIFI_SSID "Tbag"
#define WIFI_PASSWORD "Dbcooper"

// Firebase credentials
#define API_KEY "AIzaSyAcgvExvFKBu4ZuB1vC6_scQM9HPEgS9uc"
#define DATABASE_URL "https://aero-23f92-default-rtdb.firebaseio.com"

// Add Firebase Authentication credentials
#define FIREBASE_EMAIL "davechrom99@gmail.com"
#define FIREBASE_PASSWORD "0736502088"

// Define Firebase Data object
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Constants (unchanged)
#define VPD_PUMP_DURATION 5000
#define MIX_PUMP_DURATION 1000
#define PH_CHECK_INTERVAL 30000
#define PH_WAIT_INTERVAL 18000
#define PH_LOWER_LIMIT 5.5
#define PH_UPPER_LIMIT 6.5
#define DOSAGE_RATE 0.00025
#define RESERVOIR_RADIUS 20.0
#define RESERVOIR_HEIGHT 35.0
#define RESERVOIR_CHECK_INTERVAL 3600
#define ROTATION_INTERVAL 5000
#define STEPS_PER_REVOLUTION 200
#define STEPS_90_DEGREES (STEPS_PER_REVOLUTION / 4)

// Global variables
Adafruit_SHT31 sht31 = Adafruit_SHT31();
AccelStepper stepper(AccelStepper::DRIVER, STEPPER_STEP_PIN, STEPPER_DIR_PIN);

unsigned long lastVPDCycleTime = 0;
unsigned long vpdCycleInterval = 120;
unsigned long lastpHCheckTime = 0;
unsigned long lastReservoirCheckTime = 0;
unsigned long lastRotationTime = 0;
unsigned long lastDataUpdate = 0;
const unsigned long DATA_UPDATE_INTERVAL = 5000; // Update Firebase every 5 seconds

bool isVPDPumping = false;
bool isPHAdjusting = false;
bool isPHWaiting = false;
bool signupOK = false;

long ph_pump_duration = 0;
int LIGHT_THRESHOLD = 500;
float PH_TARGET = 6.0;

void setup() {
  Serial.begin(115200);
  Wire.begin(41, 42);  // ESP32-S3 default I2C pins: SDA=41, SCL=42
  
  pinMode(VPD_PUMP_RELAY, OUTPUT);
  pinMode(ACID_PUMP_RELAY, OUTPUT);
  pinMode(BASE_PUMP_RELAY, OUTPUT);
  pinMode(MIX_PUMP_RELAY, OUTPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  // Remove this line since analog pins don't need pinMode
  // pinMode(LDR_PIN, INPUT);  
  
  digitalWrite(VPD_PUMP_RELAY, LOW);
  digitalWrite(ACID_PUMP_RELAY, LOW);
  digitalWrite(BASE_PUMP_RELAY, LOW);
  digitalWrite(MIX_PUMP_RELAY, HIGH);
  
  if (!sht31.begin(0x44)) {
    Serial.println("Couldn't find SHT31");
    while (1) delay(1);
  }
  
  stepper.setMaxSpeed(1000);
  stepper.setAcceleration(500);

  // ESP32 ADC setup
  analogReadResolution(12); // ESP32 has 12-bit ADC

  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println("\nConnected to WiFi");

  // Configure Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Sign in with email and password
  auth.user.email = FIREBASE_EMAIL;
  auth.user.password = FIREBASE_PASSWORD;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Wait for authentication
  Serial.println("Authenticating...");
  while (Firebase.ready() == false) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println("\nAuthenticated successfully!");
  signupOK = true;

  config.token_status_callback = tokenStatusCallback;
}

void loop() {
  unsigned long currentTime = millis();
  
  // Read and update sensor data
  if (currentTime - lastDataUpdate >= DATA_UPDATE_INTERVAL && signupOK) {
    updateAndPublishData();
    lastDataUpdate = currentTime;
  }

  // Run system controls
  handleVPDControl(currentTime);
  handlePHControl(currentTime);
  checkReservoirVolume(currentTime);
  checkLightAndRotate(currentTime);
  
  stepper.run();
}

void updateAndPublishData() {
  if (Firebase.ready() && signupOK) {
    // Read all sensor data
    float temperature = sht31.readTemperature();
    float humidity = sht31.readHumidity();
    
    // Check if readings are valid
    if (isnan(temperature) || isnan(humidity)) {
      Serial.println("Failed to read from SHT31 sensor!");
      return;
    }

    float vpd = calculateVPD(temperature, humidity);
    float pH = readpH();
    float waterLevel = measureWaterLevel();
    float reservoirVolume = calculateReservoirVolume(waterLevel);
    int lightIntensity = analogRead(LDR_PIN);

    // Create JSON object with error checking
    FirebaseJson json;
    json.set("temperature", temperature);
    json.set("humidity", humidity);
    json.set("vpd", vpd);
    json.set("ph", pH);
    json.set("waterLevel", waterLevel);
    json.set("reservoirVolume", reservoirVolume);
    json.set("lightIntensity", lightIntensity);
    json.set("vpdPumpRunning", isVPDPumping);
    json.set("phAdjusting", isPHAdjusting);
    json.set("timestamp", time(nullptr));

    // Push to Firebase with error checking
    String path = "/sensor_readings";
    if (Firebase.RTDB.pushJSON(&fbdo, path, &json)) {
      Serial.println("Data sent to Firebase successfully");
      Serial.printf("Temperature: %.2f°C, Humidity: %.2f%%, pH: %.2f\n", 
                   temperature, humidity, pH);
    } else {
      Serial.println("Failed to send data to Firebase");
      Serial.println("REASON: " + fbdo.errorReason());
    }

    // Update system status
    FirebaseJson statusJson;
    statusJson.set("status", "Active");
    statusJson.set("lastUpdate", time(nullptr));
    statusJson.set("vpdPumpRunning", isVPDPumping);
    statusJson.set("phAdjusting", isPHAdjusting);

    if (Firebase.RTDB.setJSON(&fbdo, "/system_status", &statusJson)) {
      Serial.println("Status updated successfully");
    } else {
      Serial.println("Status update failed");
      Serial.println("REASON: " + fbdo.errorReason());
    }
  }
}

// Modified pH reading for ESP32's 12-bit ADC
float readpH() {
  int sensorValue = analogRead(PH_PIN);
  // ESP32 ADC is 12-bit (0-4095)
  return map(sensorValue, 0, 4095, 0, 14);
}

// The rest of the functions remain the same as they don't need ESP-specific modifications
// Just removing yield() calls as they're not needed for ESP32

void checkLightAndRotate(unsigned long currentTime) {
  if (currentTime - lastRotationTime >= ROTATION_INTERVAL) {
    lastRotationTime = currentTime;
    
    int lightLevel = analogRead(LDR_PIN);
    Serial.printf("Light intensity: %d\n", lightLevel);

    if (lightLevel > LIGHT_THRESHOLD) {
      stepper.moveTo(stepper.currentPosition() + STEPS_90_DEGREES);
      while (stepper.distanceToGo() != 0) {
        stepper.run();
      }
      Serial.println("Rotated 90 degrees");
    } else {
      Serial.println("Insufficient light, not rotating");
    }
  }
}

// Include all other functions here (handleVPDControl, handlePHControl, etc.)
// They remain the same as in your original code, just remove the yield() calls 

void handleVPDControl(unsigned long currentTime) {
  if (currentTime - lastVPDCycleTime >= vpdCycleInterval) {
    lastVPDCycleTime = currentTime;
    
    float humidity = sht31.readHumidity();
    float temperature = sht31.readTemperature();

    if (!isnan(humidity) && !isnan(temperature)) {
      float vpd = calculateVPD(temperature, humidity);
      updateVPDCycleInterval(vpd);
      
      Serial.printf("Humidity: %.1f%%, Temperature: %.1f°C, VPD: %.2f kPa\n", 
                   humidity, temperature, vpd);
    } else {
      Serial.println("Failed to read from SHT31 sensor!");
    }

    digitalWrite(VPD_PUMP_RELAY, HIGH);
    isVPDPumping = true;
    Serial.println("VPD Pump activated");
  }

  if (isVPDPumping && currentTime - lastVPDCycleTime >= VPD_PUMP_DURATION) {
    digitalWrite(VPD_PUMP_RELAY, LOW);
    isVPDPumping = false;
    Serial.println("VPD Pump deactivated");
  }
}

void handlePHControl(unsigned long currentTime) {
  if (!isPHAdjusting && !isPHWaiting && currentTime - lastpHCheckTime >= PH_CHECK_INTERVAL) {
    checkAndAdjustPH(currentTime);
  }

  if (isPHWaiting && currentTime - lastpHCheckTime >= PH_WAIT_INTERVAL) {
    isPHWaiting = false;
    checkAndAdjustPH(currentTime);
  }

  if (isPHAdjusting && currentTime - lastpHCheckTime >= ph_pump_duration) {
    digitalWrite(ACID_PUMP_RELAY, LOW);
    digitalWrite(BASE_PUMP_RELAY, LOW);
    digitalWrite(MIX_PUMP_RELAY, LOW);
    
    delay(MIX_PUMP_DURATION);
    
    digitalWrite(MIX_PUMP_RELAY, HIGH);
    isPHAdjusting = false;
    isPHWaiting = true;
    Serial.println("pH adjustment cycle completed, waiting before rechecking");
  }
}

void checkReservoirVolume(unsigned long currentTime) {
  if (currentTime - lastReservoirCheckTime >= RESERVOIR_CHECK_INTERVAL) {
    lastReservoirCheckTime = currentTime;
    
    float waterLevel = measureWaterLevel();
    float volume = calculateReservoirVolume(waterLevel);
    
    Serial.printf("Volume: %.1f liters\n", volume);
    ph_pump_duration = volume * DOSAGE_RATE * 1000000; // Convert to ms
  }
}

float calculateVPD(float temperature, float humidity) {
  float svp = 0.6108 * exp(17.27 * temperature / (temperature + 237.3)); 
  float avp = (humidity / 100.0) * svp;
  return svp - avp;
}

void updateVPDCycleInterval(float vpd) {
  vpdCycleInterval = (vpd > 1.5) ? 6000 : (vpd < 0.8) ? 18000 : 12000;
  Serial.printf("New VPD cycle interval: %d seconds\n", vpdCycleInterval / 1000);
}

float measureWaterLevel() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH);
  return RESERVOIR_HEIGHT - (duration * 0.034 / 2);
}

float calculateReservoirVolume(float waterLevel) {
  return PI * RESERVOIR_RADIUS * RESERVOIR_RADIUS * waterLevel / 1000.0;
}

void checkAndAdjustPH(unsigned long currentTime) {
  lastpHCheckTime = currentTime;
  float pH = readpH();
  Serial.printf("Current pH: %.2f\n", pH);

  if (pH < PH_LOWER_LIMIT || pH > PH_UPPER_LIMIT) {
    if (pH < PH_TARGET) {
      Serial.println("pH too low, activating base pump");
      digitalWrite(BASE_PUMP_RELAY, HIGH);
    } else {
      Serial.println("pH too high, activating acid pump");
      digitalWrite(ACID_PUMP_RELAY, HIGH);
    }
    isPHAdjusting = true;
    
    Serial.printf("Dosing for %ld ms based on current reservoir volume\n", ph_pump_duration);
  } else {
    Serial.println("pH within acceptable range");
  }
}