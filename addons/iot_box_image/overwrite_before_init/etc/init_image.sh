#!/usr/bin/env bash
set -o errexit
set -o nounset
set -o pipefail
# set -o xtrace

__dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
__file="${__dir}/$(basename "${BASH_SOURCE[0]}")"
__base="$(basename ${__file} .sh)"

# Recommends: antiword, graphviz, ghostscript, python-gevent, poppler-utils
export DEBIAN_FRONTEND=noninteractive

# single-user mode, appropriate for chroot environment
# explicitly setting the runlevel prevents warnings after installing packages
export RUNLEVEL=1

# Unset lang variables to prevent locale settings leaking from host
unset "${!LC_@}"
unset "${!LANG@}"

# set locale to en_US
echo "set locale to en_US"
echo "en_US.UTF-8 UTF-8" > /etc/locale.gen
dpkg-reconfigure locales

# Aliases
echo  "alias ll='ls -al'" | tee -a ~/.bashrc /home/pi/.bashrc
echo  "alias mashora='sudo systemctl stop mashora; sudo -u mashora /usr/bin/python3 /home/pi/mashora/mashora-bin --config /home/pi/mashora.conf'" | tee -a ~/.bashrc /home/pi/.bashrc
echo  "alias mashora_logs='less -R +F /var/log/mashora/mashora-server.log'" | tee -a ~/.bashrc /home/pi/.bashrc
echo  "alias mashora_conf='cat /home/pi/mashora.conf'" | tee -a ~/.bashrc /home/pi/.bashrc
echo  "alias install='sudo chroot /root_bypass_ramdisks/'" | tee -a ~/.bashrc /home/pi/.bashrc
echo  "alias blackbox='ls /dev/serial/by-path/'" | tee -a ~/.bashrc /home/pi/.bashrc
echo  "alias nano='sudo -u mashora nano -l'" | tee -a /home/pi/.bashrc
echo  "alias vim='sudo -u mashora vim -u /home/pi/.vimrc'" | tee -a /home/pi/.bashrc
echo  "alias mashora_luxe='printf \" ______\n< Luxe >\n ------\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\ \n                ||----w |\n                ||     ||\n\"'" | tee -a ~/.bashrc /home/pi/.bashrc
echo  "alias mashora_start='sudo systemctl start mashora'" >> /home/pi/.bashrc
echo  "alias mashora_stop='sudo systemctl stop mashora'" >> /home/pi/.bashrc
echo  "alias mashora_restart='sudo systemctl restart mashora'" >> /home/pi/.bashrc
echo "
mashora_help() {
  echo '-------------------------------'
  echo ' Welcome to Mashora IoT Box tools'
  echo '-------------------------------'
  echo ''
  echo 'mashora                  Starts/Restarts Mashora server manually (not through mashora.service)'
  echo 'mashora_logs             Displays Mashora server logs in real time'
  echo 'mashora_conf             Displays Mashora configuration file content'
  echo 'install               Bypasses ramdisks to allow package installation'
  echo 'blackbox              Lists all serial connected devices'
  echo 'mashora_start            Starts Mashora service'
  echo 'mashora_stop             Stops Mashora service'
  echo 'mashora_restart          Restarts Mashora service'
  echo 'mashora_dev <branch>     Resets Mashora on the specified branch from mashora-dev repository'
  echo 'mashora_origin <branch>  Resets Mashora on the specified branch from the mashora repository'
  echo 'devtools              Enables/Disables specific functions for development (more help with devtools help)'
  echo ''
  echo 'Mashora IoT online help: <https://www.mashora.com/documentation/latest/applications/general/iot.html>'
}

mashora_dev() {
  if [ -z \"\$1\" ]; then
    mashora_help
    return
  fi
  pwd=\$(pwd)
  cd /home/pi/mashora
  sudo -u mashora git remote add dev https://github.com/mashora-dev/mashora.git
  sudo -u mashora git fetch dev \$1 --depth=1 --prune
  sudo -u mashora git reset --hard FETCH_HEAD
  sudo -u mashora git branch -m \$1
  sudo chroot /root_bypass_ramdisks /bin/bash -c \"export DEBIAN_FRONTEND=noninteractive && xargs apt-get -y -o Dpkg::Options::=\"--force-confdef\" -o Dpkg::Options::=\"--force-confold\" install < /home/pi/mashora/addons/iot_box_image/configuration/packages.txt\"
  sudo -u mashora pip3 install -r /home/pi/mashora/addons/iot_box_image/configuration/requirements.txt --break-system-package
  cd \$pwd
}

mashora_origin() {
  if [ -z \"\$1\" ]; then
    mashora_help
    return
  fi
  pwd=\$(pwd)
  cd /home/pi/mashora
  sudo -u mashora git remote set-url origin https://github.com/mashora/mashora.git  # ensure mashora repository
  sudo -u mashora git fetch origin \$1 --depth=1 --prune
  sudo -u mashora git reset --hard FETCH_HEAD
  sudo -u mashora git branch -m \$1
  sudo chroot /root_bypass_ramdisks /bin/bash -c \"export DEBIAN_FRONTEND=noninteractive && xargs apt-get -y -o Dpkg::Options::=\"--force-confdef\" -o Dpkg::Options::=\"--force-confold\" install < /home/pi/mashora/addons/iot_box_image/configuration/packages.txt\"
  sudo -u mashora pip3 install -r /home/pi/mashora/addons/iot_box_image/configuration/requirements.txt --break-system-package
  cd \$pwd
}

pip() {
  if [[ -z \"\$1\" || -z \"\$2\" ]]; then
    mashora_help
    return 1
  fi
  additional_arg=\"\"
  if [ \"\$1\" == \"install\" ]; then
    additional_arg=\"--user\"
  fi
  pip3 \"\$1\" \"\$2\" --break-system-package \$additional_arg
}

devtools() {
  help_message() {
    echo 'Usage: devtools <enable/disable> <general/actions> [action name]'
    echo ''
    echo 'Only provide an action name if you want to enable/disable a specific device action.'
    echo 'If no action name is provided, all actions will be enabled/disabled.'
    echo 'To enable/disable multiple actions, enclose them in quotes separated by commas.'
  }
  case \"\$1\" in
    enable|disable)
      case \"\$2\" in
        general|actions|longpolling)
          if ! grep -q '^\[devtools\]' /home/pi/mashora.conf; then
            sudo -u mashora bash -c \"printf '\n[devtools]\n' >> /home/pi/mashora.conf\"
          fi
          if [ \"\$1\" == \"disable\" ]; then
            value=\"\${3:-*}\" # Default to '*' if no action name is provided
            devtools enable \"\$2\" # Remove action/general/longpolling from conf to avoid duplicate keys
            sudo sed -i \"/^\[devtools\]/a\\\\\$2 = \$value\" /home/pi/mashora.conf
          elif [ \"\$1\" == \"enable\" ]; then
            sudo sed -i \"/\[devtools\]/,/\[/{/\$2 =/d}\" /home/pi/mashora.conf
          fi
          ;;
        *)
          help_message
          return 1
          ;;
      esac
      ;;
    *)
      help_message
      return 1
      ;;
  esac
}
" | tee -a ~/.bashrc /home/pi/.bashrc

# Change default hostname from 'raspberrypi' to 'iotbox'
echo iotbox | tee /etc/hostname
sed -i 's/\braspberrypi/iotbox/g' /etc/hosts

apt-get update

# At the first start it is necessary to configure a password
# This will be modified by a unique password on the first start of Mashora
password="$(openssl rand -base64 12)"
echo "pi:${password}" | chpasswd
echo TrustedUserCAKeys /etc/ssh/ca.pub >> /etc/ssh/sshd_config

# Prevent Wi-Fi blocking
apt-get -y remove rfkill

echo "Acquire::Retries "16";" > /etc/apt/apt.conf.d/99acquire-retries
# KEEP OWN CONFIG FILES DURING PACKAGE CONFIGURATION
# http://serverfault.com/questions/259226/automatically-keep-current-version-of-config-files-when-apt-get-install
xargs apt-get -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" install < /home/pi/mashora/addons/iot_box_image/configuration/packages.txt
apt-get -y autoremove

apt-get clean
localepurge
rm -rfv /usr/share/doc

# Remove the default nginx website, we have our own config in /etc/nginx/conf.d/
rm /etc/nginx/sites-enabled/default

pip3 install -r /home/pi/mashora/addons/iot_box_image/configuration/requirements.txt --break-system-package

# Create Mashora user for mashora service and disable password login
adduser --disabled-password --gecos "" --shell /usr/sbin/nologin mashora

# mashora user doesn't need to type its password to run sudo commands
cp /etc/sudoers.d/010_pi-nopasswd /etc/sudoers.d/010_mashora-nopasswd
sed -i 's/pi/mashora/g' /etc/sudoers.d/010_mashora-nopasswd

# copy the mashora.conf file to the overwrite directory
mv -v "/home/pi/mashora/addons/iot_box_image/configuration/mashora.conf" "/home/pi/"
chown mashora:mashora "/home/pi/mashora.conf"

groupadd usbusers
usermod -a -G usbusers mashora
usermod -a -G video mashora
usermod -a -G render mashora
usermod -a -G lp mashora
usermod -a -G input mashora
usermod -a -G dialout mashora
usermod -a -G pi mashora
mkdir -v /var/log/mashora
chown mashora:mashora /var/log/mashora
chown mashora:mashora -R /home/pi/mashora/

# logrotate is very picky when it comes to file permissions
chown -R root:root /etc/logrotate.d/
chmod -R 644 /etc/logrotate.d/
chown root:root /etc/logrotate.conf
chmod 644 /etc/logrotate.conf

update-rc.d -f hostapd remove
update-rc.d -f nginx remove
update-rc.d -f dnsmasq remove

systemctl enable ramdisks.service
systemctl disable dphys-swapfile.service
systemctl enable ssh
systemctl set-default graphical.target
systemctl disable getty@tty1.service
systemctl disable systemd-timesyncd.service
systemctl unmask hostapd.service
systemctl disable hostapd.service
systemctl disable cups-browsed.service
systemctl enable labwc.service
systemctl enable mashora.service
systemctl enable mashora-led-manager.service
systemctl enable mashora-ngrok.service

# create dirs for ramdisks
create_ramdisk_dir () {
    mkdir -v "${1}_ram"
}

create_ramdisk_dir "/var"
create_ramdisk_dir "/etc"
create_ramdisk_dir "/tmp"
mkdir -v /root_bypass_ramdisks

echo ""
echo "--- DEFAULT PASSWORD: ${password} ---"
echo ""
