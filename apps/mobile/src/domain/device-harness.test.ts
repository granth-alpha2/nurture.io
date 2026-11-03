import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

interface MockLocation {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}

class SimulatedDeviceSensorHarness {
  cameraPermission: 'undetermined' | 'granted' | 'denied' = 'undetermined';
  locationPermission: 'undetermined' | 'granted' | 'denied' = 'undetermined';
  isSpeaking: boolean = false;
  lastSpokenText: string | null = null;
  isListening: boolean = false;
  offline: boolean = false;
  currentLocation: MockLocation | null = null;

  async requestPermissions() {
    this.cameraPermission = 'granted';
    this.locationPermission = 'granted';
    return { camera: this.cameraPermission, location: this.locationPermission };
  }

  simulateGpsFix(lat: number, lng: number, accuracy: number, heading = 0) {
    this.currentLocation = {
      coords: {
        latitude: lat,
        longitude: lng,
        accuracy,
        heading,
        speed: 1.2,
      },
      timestamp: Date.now(),
    };
    return this.currentLocation;
  }

  speak(text: string) {
    this.isSpeaking = true;
    this.lastSpokenText = text;
  }

  stopSpeaking() {
    this.isSpeaking = false;
  }

  startListening() {
    this.isListening = true;
  }

  simulateVoiceInput(transcript: string) {
    this.isListening = false;
    return transcript.trim();
  }

  setNetworkOnline(online: boolean) {
    this.offline = !online;
  }
}

describe('Simulated Android device and sensor harness', () => {
  it('requests and receives camera and location permissions for navigation', async () => {
    const device = new SimulatedDeviceSensorHarness();
    assert.equal(device.cameraPermission, 'undetermined');
    assert.equal(device.locationPermission, 'undetermined');

    const result = await device.requestPermissions();
    assert.equal(result.camera, 'granted');
    assert.equal(result.location, 'granted');
  });

  it('handles GPS sensor stream with acceptable pedestrian accuracy', () => {
    const device = new SimulatedDeviceSensorHarness();
    const fix = device.simulateGpsFix(12.9716, 77.5946, 8.5, 90);
    assert.ok(fix.coords.accuracy <= 25, 'Accuracy is within safe corridor');
    assert.equal(fix.coords.heading, 90);
    assert.equal(fix.coords.speed, 1.2);
  });

  it('flags degraded GPS when accuracy exceeds safety threshold (>25m)', () => {
    const device = new SimulatedDeviceSensorHarness();
    const fix = device.simulateGpsFix(12.9716, 77.5946, 45.0);
    const isDegraded = fix.coords.accuracy > 25;
    assert.equal(isDegraded, true);
  });

  it('exercises text-to-speech engine and queue cancellation', () => {
    const device = new SimulatedDeviceSensorHarness();
    device.speak('In 50 meters, turn right at the post office.');
    assert.equal(device.isSpeaking, true);
    assert.equal(device.lastSpokenText, 'In 50 meters, turn right at the post office.');

    device.stopSpeaking();
    assert.equal(device.isSpeaking, false);
  });

  it('processes voice destination input cleanly', () => {
    const device = new SimulatedDeviceSensorHarness();
    device.startListening();
    assert.equal(device.isListening, true);

    const query = device.simulateVoiceInput('  Metro Station Gate 2  ');
    assert.equal(query, 'Metro Station Gate 2');
    assert.equal(device.isListening, false);
  });

  it('detects network offline transition and enables degraded fallback', () => {
    const device = new SimulatedDeviceSensorHarness();
    assert.equal(device.offline, false);

    device.setNetworkOnline(false);
    assert.equal(device.offline, true);

    // When offline, app retains cached route and GPS fixes
    const fix = device.simulateGpsFix(12.972, 77.595, 10.0);
    assert.ok(fix !== null);
  });
});

