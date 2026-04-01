%global name mashora
%global unmangled_version %{version}
%global __requires_exclude ^.*mashora/addons/mail/static/scripts/mashora-mailgate.py$

Summary: Mashora Server
Name: %{name}
Version: %{version}
Release: %{release}
Source0: %{name}-%{unmangled_version}.tar.gz
License: LGPL-3
Group: Development/Libraries
BuildRoot: %{_tmppath}/%{name}-%{version}-%{release}-buildroot
Prefix: %{_prefix}
BuildArch: noarch
Vendor: Mashora <info@mashora.com>
Requires: sassc
BuildRequires: python3-devel
BuildRequires: pyproject-rpm-macros
Url: https://www.mashora.com

%description
Mashora is a complete ERP and CRM. The main features are accounting (analytic
and financial), stock management, sales and purchases management, tasks
automation, marketing campaigns, help desk, POS, etc. Technical features include
a distributed server, an object database, a dynamic GUI,
customizable reports, and XML-RPC interfaces.

%generate_buildrequires
%pyproject_buildrequires

%prep
%autosetup

%build
%py3_build

%install
%py3_install

%post
#!/bin/sh

set -e

MASHORA_CONFIGURATION_DIR=/etc/mashora
MASHORA_CONFIGURATION_FILE=$MASHORA_CONFIGURATION_DIR/mashora.conf
MASHORA_DATA_DIR=/var/lib/mashora
MASHORA_GROUP="mashora"
MASHORA_LOG_DIR=/var/log/mashora
MASHORA_LOG_FILE=$MASHORA_LOG_DIR/mashora-server.log
MASHORA_USER="mashora"

if ! getent passwd | grep -q "^mashora:"; then
    groupadd $MASHORA_GROUP
    adduser --system --no-create-home $MASHORA_USER -g $MASHORA_GROUP
fi
# Register "$MASHORA_USER" as a postgres user with "Create DB" role attribute
su - postgres -c "createuser -d -R -S $MASHORA_USER" 2> /dev/null || true
# Configuration file
mkdir -p $MASHORA_CONFIGURATION_DIR
# can't copy debian config-file as addons_path is not the same
if [ ! -f $MASHORA_CONFIGURATION_FILE ]
then
    echo "[options]
; This is the password that allows database operations:
; admin_passwd = admin
db_host = False
db_port = False
db_user = $MASHORA_USER
db_password = False
addons_path = %{python3_sitelib}/mashora/addons
default_productivity_apps = True
" > $MASHORA_CONFIGURATION_FILE
    chown $MASHORA_USER:$MASHORA_GROUP $MASHORA_CONFIGURATION_FILE
    chmod 0640 $MASHORA_CONFIGURATION_FILE
fi
# Log
mkdir -p $MASHORA_LOG_DIR
chown $MASHORA_USER:$MASHORA_GROUP $MASHORA_LOG_DIR
chmod 0750 $MASHORA_LOG_DIR
# Data dir
mkdir -p $MASHORA_DATA_DIR
chown $MASHORA_USER:$MASHORA_GROUP $MASHORA_DATA_DIR

INIT_FILE=/lib/systemd/system/mashora.service
touch $INIT_FILE
chmod 0700 $INIT_FILE
cat << EOF > $INIT_FILE
[Unit]
Description=Mashora Open Source ERP and CRM
After=network.target

[Service]
Type=simple
User=mashora
Group=mashora
ExecStart=/usr/bin/mashora --config $MASHORA_CONFIGURATION_FILE --logfile $MASHORA_LOG_FILE
KillMode=mixed

[Install]
WantedBy=multi-user.target
EOF

%files
%{_bindir}/mashora
%{python3_sitelib}/%{name}-*.egg-info
%{python3_sitelib}/%{name}
%pycached %exclude %{python3_sitelib}/doc/cla/stats.py
%pycached %exclude %{python3_sitelib}/setup/*.py
%exclude %{python3_sitelib}/setup/mashora

%changelog
* %{build_date} Mashora Team <info@mashora.com> - %{version}-%{release}
- Latest updates
