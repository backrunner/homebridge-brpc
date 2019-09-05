# homebridge-brpc

## Description

This plugin can help you add your PC into the HomeKit as a switch, then you can control your PC through the app.

Tips: Recommend to use Raspberry pi.

## Usage

```bash
npm install homebridge-brpc -g
```

## Config

```json
{
    "bridge": {
        "name": "Homebridge",
        "username": "00:0C:29:E1:25:B2",
        "port": 51826,
        "pin": "031-45-154"
    },
    "accessories": [{
        "accessory": "PC",
        "name": "My Computer",
        "model": "Unknown",
        "manufacturer": "Unknown",
        "software": "Windows",
        "pc_mac": "00:00:00:00:00:00",
        "service_url": "http://192.168.1.xxx:8300",
        "auth_username": "",
        "auth_key": "",
        "interval": 5000
    }]
}
```
