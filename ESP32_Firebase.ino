#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <time.h>

// WiFi credentials
#define WIFI_SSID "Tbag"
#define WIFI_PASSWORD "Dbcooper"

// Firebase credentials
#define API_KEY "AIzaSyAcgvExvFKBu4ZuB1vC6_scQM9HPEgS9uc"
#define DATABASE_URL "https://aero-23f92-default-rtdb.firebaseio.com"

// Firebase user credentials - Replace with your email and password
#define USER_EMAIL "your-email@example.com"
#define USER_PASSWORD "your-password"

// Define Firebase Data object
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Sensor pin
const int SENSOR_PIN = 34;  // ADC pin connected to sensor

// Variable to save current epoch time
unsigned long sendDataPrevMillis = 0;
bool signupOK = false;

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println();
  Serial.print("Connected with IP: ");
  Serial.println(WiFi.localIP());

  // Configure time
  configTime(0, 0, "pool.ntp.org");

  // Configure Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Authenticate using email/password
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  Serial.println("Getting User UID");
  while ((auth.token.uid) == "") {
    Serial.print('.');
    delay(1000);
  }
  
  // Print user UID
  Serial.print("User UID: ");
  Serial.println(auth.token.uid.c_str());
  
  signupOK = true;
}

void loop() {
  if (Firebase.ready() && signupOK && (millis() - sendDataPrevMillis > 5000 || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();
    
    // Read sensor value
    int sensorValue = analogRead(SENSOR_PIN);
    
    // Get current timestamp
    time_t now;
    time(&now);
    
    // Create JSON data
    FirebaseJson json;
    json.set("value", sensorValue);
    json.set("timestamp", (int)now);
    
    // Push data to Firebase
    if (Firebase.RTDB.pushJSON(&fbdo, "/sensor_readings", &json)) {
      Serial.println("Data sent successfully");
      Serial.print("Sensor value: ");
      Serial.println(sensorValue);
    } else {
      Serial.println("Failed to send data");
      Serial.println("REASON: " + fbdo.errorReason());
    }
  }
} 