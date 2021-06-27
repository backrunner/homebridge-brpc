const wol = require('node-wol');
const request = require('request');

var Service;
var Characteristic;

const Status = {
  Online: Symbol('Online'),
  Offline: Symbol('Offline'),
  WakingUp: Symbol('Waking Up'),
  ShuttingDown: Symbol('Shutting Down'),
  Unknown: Symbol('Unknown'),
};

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-brpc', 'PC', HomeBridgePC);
};

function HomeBridgePC(log, config) {
  this.log = log;
  this.name = config.name;
  this.infomationService = new Service.AccessoryInformation();
  this.infomation = {
    serialNumber: 'Unknown',
    name: config.name ? config.name : 'PC',
    model: config.model ? config.model : 'PC',
    manufacturer: config.manufacturer ? config.manufacturer : 'Unknown',
    softwareVersion: config.software ? config.software : 'Unknown',
  };
  // PC配置
  this.pc_mac = config.pc_mac;
  this.service_url = config.service_url;
  this.auth_username = config.auth_username;
  this.auth_key = config.auth_key;

  // 基本信息
  this.status = Status.Offline;

  // 计时器
  this.interval = config.interval;
  this.timer = setInterval(this.pinger.bind(this), this.interval);
  this.lastOperation = null;

  // action
  this.hibernate = config.hibernate;

  // set switchService
  this.switchService = new Service.Switch(this.name);
  this.switchService.getCharacteristic(Characteristic.On).on('get', this.getStatus.bind(this)).on('set', this.setStatus.bind(this));

  // set infomation
  this.infomationService.setCharacteristic(Characteristic.Manufacturer, this.infomation.manufacturer).setCharacteristic(Characteristic.Model, this.infomation.model).setCharacteristic(Characteristic.SerialNumber, this.infomation.serialNumber).setCharacteristic(Characteristic.Name, this.infomation.name).setCharacteristic(Characteristic.SoftwareRevision, this.infomation.softwareVersion);
}

HomeBridgePC.prototype.getStatus = function (callback) {
  callback(null, this.status === Status.Online || this.status === Status.WakingUp);
};

HomeBridgePC.prototype.setStatus = function (on, callback) {
  if (!this.lastOperation) {
    this.lastOperation = Date.now();
  } else if (Date.now() - this.lastOperation <= 1000) {
    // avoid duplicated request
    return;
  }
  if (on) {
    // 打开设备
    if (!this.pc_mac) {
      callback(new Error('PC MAC cannot be empty.'));
      return;
    }
    // 通过wol唤醒
    this.status = Status.WakingUp;
    this.on_callback = callback;
    // 设置timer
    if (!this.timer) {
      this.timer = setInterval(this.pinger.bind(this), this.interval);
    }
    if (Array.isArray(this.pc_mac)) {
      this.pc_mac.forEach((macAddr, index) => {
        wol.wake(
          macAddr,
          function (err) {
            if (index !== this.pc_mac.length - 1) {
              return;
            }
            if (err) {
              // 唤醒失败，设置状态为关闭
              this.status = Status.Offline;
              this.on_callback(null, false);
            } else {
              this.on_callback(null, true);
            }
          }.bind(this)
        );
      });
    } else {
      wol.wake(
        this.pc_mac,
        function (err) {
          if (err) {
            // 唤醒失败，设置状态为关闭
            this.status = Status.Offline;
            this.on_callback(null, false);
          } else {
            this.on_callback(null, true);
          }
        }.bind(this)
      );
    }
  } else {
    // 关闭设备
    if (this.service_url) {
      this.off_callback = callback;
      request.get(
        {
          url: `${this.service_url}/action/${this.hibernate ? 'hibernate' : 'shutdown'}`,
          headers: {
            Authorization: this.auth_username + ':' + this.auth_key,
          },
        },
        function (error, response, body) {
          if (response.statusCode == 200) {
            this.status = Status.ShuttingDown;
            this.off_callback(null, false);
          } else {
            this.off_callback(null, true);
          }
        }.bind(this)
      );
    } else {
      callback(new Error('Service URL cannot be empty.'));
      return;
    }
  }
};

HomeBridgePC.prototype.getServices = function () {
  return [this.infomationService, this.switchService];
};

HomeBridgePC.prototype.pinger = function () {
  if (this.lastOperation && Date.now - this.lastOperation <= 1000) {
    return;
  }
  request.get(
    this.service_url + '/ping',
    {
      timeout: this.interval,
    },
    function (error, response) {
      if (error) {
        if (this.status == Status.ShuttingDown) {
          clearInterval(timer);
        }
        this.status = Status.Offline;
        return;
      }
      if (response.statusCode == 200) {
        this.status = Status.Online;
      } else {
        this.status = Status.Unknown;
      }
    }.bind(this)
  );
};
