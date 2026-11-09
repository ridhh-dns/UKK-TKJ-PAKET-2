# Mapping Aset & Panduan Konten Web Tutorial UKK TKJ Paket 2
**Judul Tugas:** Merancang Arsitektur, Layanan, Perangkat Lunak dan Sarana pada Jaringan Private Cloud

## Aturan Pembuatan Halaman Web untuk AI Agent (`agy`):
1. Gunakan urutan langkah, path gambar, dan penjelasan di bawah ini secara presisi.
2. Jangan membuka/memindai isi visual file gambar `.png`/`.jpeg` untuk menghemat token; cukup gunakan path gambar yang tertulis di dokumen ini pada tag `<img src="...">`.
3. Tampilkan setiap **Blok Kode CLI** tepat di posisi yang ditentukan (**Sebelum Gambar** atau **Sesudah Gambar**) dengan fitur *syntax highlighting* dan tombol *Copy*.

---

## Bagian 1: Konfigurasi Router MikroTik & Client (`assets/1-Mikrotik/`)

### 1.1 Login & Konfigurasi IP Address Router
1. **Gambar:** `assets/1-Mikrotik/1-masuk-ke-panel-winbox.png`
   - **Penjelasan:** Masuk ke panel konfigurasi router MikroTik menggunakan aplikasi WinBox.
2. **Gambar:** `assets/1-Mikrotik/2-ip.png`
   - **Penjelasan:** Membuka menu **IP** pada sidebar kiri WinBox.
3. **Gambar:** `assets/1-Mikrotik/3-setting-address.png`
   - **Penjelasan:** Memilih submenu **Addresses** dan menekan ikon tambah (`+`) untuk mulai mengatur alamat IP.
4. **Gambar:** `assets/1-Mikrotik/4-setting-ether1.png`
   - **Penjelasan:** Mengatur IP pada interface `ether1` (jalur sumber internet ISP: `10.10.10.xx/24`).
5. **Gambar:** `assets/1-Mikrotik/5-setting-ether2.png`
   - **Penjelasan:** Mengatur IP pada interface `ether2` (jalur menuju jaringan VirtualBox VM: `192.168.xx.1/29`).
6. **Gambar:** `assets/1-Mikrotik/6-setting-ether-3.png`
   - **Penjelasan:** Mengatur IP pada interface `ether3` (jalur jaringan lokal `int-client`: `192.168.100.1/24`).

### 1.2 Konfigurasi Firewall NAT (Internet Gateway & Port Forwarding LMS)
7. **Gambar:** `assets/1-Mikrotik/7-firewall.png`
   - **Penjelasan:** Membuka menu **IP > Firewall**.
8. **Gambar:** `assets/1-Mikrotik/8-nat.png`
   - **Penjelasan:** Beralih ke tab **NAT** dan menambahkan rule baru (`+`).
9. **Gambar:** `assets/1-Mikrotik/9-srcnat-ether1.png`
   - **Penjelasan:** Pada tab General, memilih **Chain: srcnat** dan **Out. Interface: ether1** untuk akses internet gateway.
10. **Gambar:** `assets/1-Mikrotik/10-masquerade.png`
    - **Penjelasan:** Pada tab Action, memilih **Action: masquerade** lalu klik OK.
11. **Gambar:** `assets/1-Mikrotik/11-dstnat-ether1.png`
    - **Penjelasan:** Membuat rule Port Forwarding (Destination NAT) dengan **Chain: dstnat** pada `ether1` (menerima akses luar pada IP ISP port `9090`) dan protocol tcp(6) dengan in interface ether 1.
12. **Gambar:** `assets/1-Mikrotik/12-dstnat-port80.png`
    - **Penjelasan:** Pada tab Action, memilih **Action: dst-nat** dan mengarahkan **To Addresses** ke IP VM Web Server (`192.168.xx.2`) dengan **To Ports: 80**.

### 1.3 Konfigurasi DHCP Server untuk Jaringan Lokal
13. **Gambar:** `assets/1-Mikrotik/13-dhcp-server.png`
    - **Penjelasan:** Membuka menu **IP > DHCP Server**.
14. **Gambar:** `assets/1-Mikrotik/14-dhcp-server-2.png`
    - **Penjelasan:** Tampilan jendela DHCP Server, lalu menekan tombol **DHCP Setup**.
15. **Gambar:** `assets/1-Mikrotik/15-dhcp-setup.png`
    - **Penjelasan:** Memilih interface jaringan lokal (`ether3` / `int-client`) pada wizard DHCP Setup.
16. **Gambar:** `assets/1-Mikrotik/16-ip-address-give-out.png`
    - **Penjelasan:** Menentukan rentang alamat IP (*Addresses to Give Out*) yang akan dibagikan ke client.
17. **Gambar:** `assets/1-Mikrotik/17-dns-dhcp.png`
    - **Penjelasan:** Menentukan DNS Server untuk client DHCP hingga proses setup selesai.

### 1.4 Konfigurasi Routing (Gateway) & DNS
18. **Gambar:** `assets/1-Mikrotik/18-route.png`
    - **Penjelasan:** Membuka menu **IP > Routes**.
19. **Gambar:** `assets/1-Mikrotik/19-route-tampilan.png`
    - **Penjelasan:** Tampilan daftar tabel routing dan menekan tombol tambah (`+`).
20. **Gambar:** `assets/1-Mikrotik/20-tambahkan-gateway.png`
    - **Penjelasan:** Mengisi **Gateway** dengan alamat IP gateway dari ISP pada jalur `ether1`.
21. **Gambar:** `assets/1-Mikrotik/21-save.png`
    - **Penjelasan:** Menyimpan konfigurasi route dan memastikan statusnya aktif (**AS** - *Active Static*).
22. **Gambar:** `assets/1-Mikrotik/22-isi-dns.png`
    - **Penjelasan:** Membuka menu **IP > DNS**.
23. **Gambar:** `assets/1-Mikrotik/23-dns-google.png`
    - **Penjelasan:** Mengisi **Servers** dengan DNS Google (`8.8.8.8`), mencentang **Allow Remote Requests**, lalu klik OK.

### 1.5 Konfigurasi Jaringan PC Client & Uji Konektivitas
24. **Gambar:** `assets/1-Mikrotik/24-ncpa-cpl.png`
    - **Penjelasan:** Membuka kotak dialog Run (`Win + R`) di PC Client dan mengetikkan `ncpa.cpl`.
25. **Gambar:** `assets/1-Mikrotik/25-adapter.png`
    - **Penjelasan:** Memilih adapter Ethernet pada jendela Network Connections.
26. **Gambar:** `assets/1-Mikrotik/26-properties.png`
    - **Penjelasan:** Membuka jendela Status/Properties pada adapter Ethernet.
27. **Gambar:** `assets/1-Mikrotik/27-ip-manual.png`
    - **Penjelasan:** Memilih **Internet Protocol Version 4 (TCP/IPv4)** lalu klik Properties.
28. **Gambar:** `assets/1-Mikrotik/28-static-ip.png`
    - **Penjelasan:** Mengatur konfigurasi IP pada sisi client dan menekan OK.
29. **Gambar:** `assets/1-Mikrotik/29-network-access.png`
    - **Penjelasan:** Memastikan status jaringan pada PC client sudah terhubung (*Internet access*).
30. **Gambar:** `assets/1-Mikrotik/30-buka-terminal.png`
    - **Penjelasan:** Kembali ke WinBox dan memilih menu **New Terminal**.
31. **Gambar:** `assets/1-Mikrotik/31-terminal.png`
    - **Penjelasan:** Tampilan awal jendela CLI Terminal MikroTik.
32. **Gambar:** `assets/1-Mikrotik/32-ping.png`
    - **Penjelasan:** Melakukan pengujian konektivitas jaringan menggunakan perintah `ping` dari terminal dan memastikan hasilnya *reply*.

---

## Bagian 2: Pembuatan & Konfigurasi Mesin Virtual di VirtualBox (`assets/2-Setup_vm/`)

1. **Gambar:** `assets/2-Setup_vm/1-virtual_box.png`
   - **Penjelasan:** Membuka aplikasi Oracle VM VirtualBox dan menekan tombol **New** untuk mulai membuat mesin virtual.
2. **Gambar:** `assets/2-Setup_vm/2-pilih-iso.png`
   - **Penjelasan:** Menentukan nama VM (`web-xx`), memilih file **ISO Debian**, serta mengatur alokasi spesifikasi minimal **RAM 2 GB (2048 MB)** dan **1 CPU**.
3. **Gambar:** `assets/2-Setup_vm/3-vm-jadi.png`
   - **Penjelasan:** Tampilan mesin virtual pada dashboard VirtualBox setelah berhasil dibuat.
4. **Gambar:** `assets/2-Setup_vm/4-setting-bridge-adapter.png`
   - **Penjelasan:** Membuka menu **Settings > Network**, lalu mengubah mode *Attached to* menjadi **Bridged Adapter** agar VM berada satu segmen jaringan dengan router (`192.168.xx.0/29`).

---

## Bagian 3: Instalasi Sistem Operasi Debian Server (`assets/3-Debian_installasi/`)

### 3.1 Pemilihan Bahasa, Lokasi & Keyboard
1. **Gambar:** `assets/3-Debian_installasi/1-install.png` — Memilih menu **Install** pada layar awal boot ISO Debian.
2. **Gambar:** `assets/3-Debian_installasi/2-bahasa.png` — Memilih bahasa **English**.
3. **Gambar:** `assets/3-Debian_installasi/3-lokasi.png` — Memilih opsi **other** pada pemilihan lokasi.
4. **Gambar:** `assets/3-Debian_installasi/4-lokasi-2.png` — Memilih kawasan **Asia**.
5. **Gambar:** `assets/3-Debian_installasi/5-lokasi-3.png` — Memilih negara **Indonesia**.
6. **Gambar:** `assets/3-Debian_installasi/6-locales.png` — Memilih lokalisasi default (**United States - en_US.UTF-8**).
7. **Gambar:** `assets/3-Debian_installasi/7-keyboard.png` — Memilih tata letak keyboard (**American English**).

### 3.2 Konfigurasi Jaringan Statis & Hostname
8. **Gambar:** `assets/3-Debian_installasi/8-ip-static-1.png` — Memilih pengaturan jaringan secara manual.
9. **Gambar:** `assets/3-Debian_installasi/9-ip-static-2.png` — Memilih opsi **Configure network manually**.
10. **Gambar:** `assets/3-Debian_installasi/10-ip-static-web.png` — Mengisi alamat IP statis VM Web Server (`192.168.xx.2`).
11. **Gambar:** `assets/3-Debian_installasi/11-netmask-248.png` — Mengisi Netmask `255.255.255.248` (`/29`).
12. **Gambar:** `assets/3-Debian_installasi/12-gateway-xx.1.png` — Mengisi IP Gateway `192.168.xx.1`.
13. **Gambar:** `assets/3-Debian_installasi/13-dns-8888.png` — Mengisi DNS Server dengan `8.8.8.8`.
14. **Gambar:** `assets/3-Debian_installasi/14-hostname.png` — Mengisi Hostname (`web-xx`).
15. **Gambar:** `assets/3-Debian_installasi/15-domain-name-kosongi.png` — Mengosongkan bagian Domain name lalu klik Continue.

### 3.3 Pengaturan Akun Root, User & Zona Waktu
16. **Gambar:** `assets/3-Debian_installasi/16-root-pass.png` — Memasukkan password akun `root`.
17. **Gambar:** `assets/3-Debian_installasi/17-re-enter-root.png` — Memasukkan ulang password `root`.
18. **Gambar:** `assets/3-Debian_installasi/18-full-name.png` — Mengisi nama lengkap pengguna baru.
19. **Gambar:** `assets/3-Debian_installasi/19-username.png` — Mengisi username pengguna baru.
20. **Gambar:** `assets/3-Debian_installasi/20-user-pass.png` — Memasukkan password pengguna baru.
21. **Gambar:** `assets/3-Debian_installasi/21-re-enter-usr-pass.png` — Memasukkan ulang password pengguna baru.
22. **Gambar:** `assets/3-Debian_installasi/22-clock.png` — Memilih zona waktu Indonesia.

### 3.4 Partisi Disk, Software & Boot Loader GRUB
23. **Gambar:** `assets/3-Debian_installasi/23-guided-partition.png` — Memilih metode **Guided - use entire disk**.
24. **Gambar:** `assets/3-Debian_installasi/24-select-partition-disk.png` — Memilih disk virtual yang akan dipartisi.
25. **Gambar:** `assets/3-Debian_installasi/25-all-in-one-partition.png` — Memilih **All files in one partition**.
26. **Gambar:** `assets/3-Debian_installasi/26-finish-part.png` — Memilih **Finish partitioning and write changes to disk**.
27. **Gambar:** `assets/3-Debian_installasi/27-writing-disk.png` — Memilih **Yes** untuk menyimpan partisi.
28. **Gambar:** `assets/3-Debian_installasi/28-install-extra-no.png` — Memilih **No** saat ditanya media instalasi tambahan.
29. **Gambar:** `assets/3-Debian_installasi/29-select-mirror.png` — Pengaturan network mirror awal.
30. **Gambar:** `assets/3-Debian_installasi/30-without-mirror.png` — Melanjutkan instalasi tanpa network mirror terlebih dahulu.
31. **Gambar:** `assets/3-Debian_installasi/31-popularity-contest.png` — Memilih **No** pada survei *popularity-contest*.
32. **Gambar:** `assets/3-Debian_installasi/32-choose-software.png` — Memilih paket **standard system utilities**.
33. **Gambar:** `assets/3-Debian_installasi/33-boot-loader.png` — Memilih **Yes** untuk memasang GRUB boot loader.
34. **Gambar:** `assets/3-Debian_installasi/34-grub-boot.png` — Memilih disk `/dev/sda` untuk instalasi GRUB.
35. **Gambar:** `assets/3-Debian_installasi/35-finish.png` — Instalasi selesai dan me-reboot VM.

---

## Bagian 4: Setup Awal Debian, Repositori & Cloning VM (`assets/4-Debian_set_up/`)

1. **Langkah 1: Cek IP Address VM Web Server**
   - **Blok Kode CLI (Sebelum Gambar):**
     ```bash
     ip a
     ```
   - **Gambar:** `assets/4-Debian_set_up/1-ip-a.png`
   - **Penjelasan:** Mengecek alamat IP pada interface jaringan VM Web Server.

2. **Langkah 2: Uji Koneksi Internet & DNS**
   - **Blok Kode CLI (Sebelum Gambar):**
     ```bash
     ping moodle.org
     ```
   - **Gambar:** `assets/4-Debian_set_up/2-ping-moodle.org.png`
   - **Penjelasan:** Menguji koneksi internet dari VM dengan melakukan ping ke `moodle.org`.

3. **Langkah 3: Konfigurasi Network Mirror Secara Manual**
   - **Blok Kode CLI (Sebelum Gambar):**
     ```bash
     nano /etc/apt/sources.list
     ```
   - **Gambar:** `assets/4-Debian_set_up/3-network-mirror-deb.png`
   - **Penjelasan:** Mengisi daftar repositori network mirror resmi Debian (`deb https://deb.debian.org/...`) di dalam file `/etc/apt/sources.list`.

4. **Langkah 4: Update Daftar Paket Repositori**
   - **Blok Kode CLI (Sebelum Gambar):**
     ```bash
     apt update
     ```
   - **Gambar:** `assets/4-Debian_set_up/4-apt-update.png`
   - **Penjelasan:** Memperbarui indeks daftar paket dari repositori Debian.

5. **Langkah 5: Cloning VM untuk Database Server (`db_server`)**
   - **Gambar:** `assets/4-Debian_set_up/5-clone.png` — Mematikan VM Web Server lalu memilih menu **Clone** di VirtualBox.
   - **Gambar:** `assets/4-Debian_set_up/6-fully-clone.png` — Mengubah nama hasil clone menjadi `db_server` dan memilih **Full Clone**.
   - **Gambar:** `assets/4-Debian_set_up/7-refresh-mac-in-clone.png` — Membuka pengaturan Network Bridged Adapter pada `db_server` lalu melakukan **Refresh MAC Address** agar tidak sama dengan Web Server.

6. **Langkah 6: Mengganti IP Statis di `db_server`**
   - **Blok Kode CLI (Sebelum Gambar):**
     ```bash
     nano /etc/network/interfaces
     ```
   - **Gambar:** `assets/4-Debian_set_up/8-change-ip-in-db.png`
   - **Penjelasan:** Mengubah alamat IP statis milik `db_server` menjadi `192.168.xx.3/29`.
   - **Blok Kode CLI (Sesudah Gambar):**
     ```bash
     systemctl restart networking
     ip a
     ```
   - **Gambar:** `assets/4-Debian_set_up/9-validate-ip.png`
   - **Penjelasan:** Memvalidasi perubahan alamat IP di `db_server` menggunakan perintah `ip a`.

---

## Bagian 5: Konfigurasi Database Server MariaDB (`assets/5-Db_server/`)

1. **Langkah 1: Instalasi MariaDB & Konfigurasi Remote Access (`bind-address`)**
   - **Blok Kode CLI (Sebelum Gambar):**
     ```bash
     apt install mariadb-server -y
     nano /etc/mysql/mariadb.conf.d/50-server.cnf
     ```
   - **Gambar:** `assets/5-Db_server/1-bind-0000.png`
   - **Penjelasan:** Mencari baris `bind-address` dan mengubah nilainya dari `127.0.0.1` menjadi `0.0.0.0` agar database dapat diakses secara remote dari VM Web Server.
   - **Blok Kode CLI (Sesudah Gambar):**
     ```bash
     systemctl restart mariadb
     ```

2. **Langkah 2: Pembuatan Database & User untuk Moodle**
   - **Blok Kode CLI (Sebelum Gambar):**
     Masuk ke konsol MariaDB menggunakan `mysql -u root -p` lalu membuat database dan user untuk IP Web Server:
     ```bash
     mysql -u root -p
     ```
     ```sql
     CREATE DATABASE moodle DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
     CREATE USER 'moodleuser'@'192.168.3.2' IDENTIFIED BY '1';
     GRANT ALL PRIVILEGES ON moodle.* TO 'moodleuser'@'192.168.3.2';
     FLUSH PRIVILEGES;
     EXIT;
     ```
   - **Gambar:** `assets/5-Db_server/2-db-configuration.png`
   - **Penjelasan:** Eksekusi perintah SQL untuk membuat database `moodle` dan memberikan hak akses penuh kepada `moodleuser` dari alamat IP Web Server.

---

## Bagian 6: Konfigurasi Web Server, Instalasi & Pengujian LMS Moodle (`assets/6-Web_server/`)

### 6.1 Instalasi Paket Web Server & Ekstraksi Source Code Moodle
1. **Langkah 1: Instalasi Apache2, PHP & Unduh Moodle**
   - **Blok Kode CLI (Sebelum Gambar):**
     ```bash
     apt install apache2 mariadb-client php libapache2-mod-php php-mysql php-xml php-mbstring php-curl php-zip php-gd php-intl php-soap -y
     cd /var/www/html
     wget [https://download.moodle.org/download.php/direct/stable503/moodle-latest-503.tgz](https://download.moodle.org/download.php/direct/stable503/moodle-latest-503.tgz)
     ```
   - **Gambar:** `assets/6-Web_server/1-moodle-tar.png`
   - **Penjelasan:** Mengunduh file arsip `moodle-latest-503.tgz` di dalam direktori `/var/www/html`.

2. **Langkah 2: Ekstraksi File Moodle ke `/var/www/html`**
   - **Blok Kode CLI (Sebelum Gambar):**
     ```bash
     tar -zxvf moodle-latest-503.tgz
     mv moodle-latest-503.tgz /etc
     mv moodle/* .
     ls
     ```
   - **Gambar:** `assets/6-Web_server/2-moodle-folder.png`
   - **Penjelasan:** Mengekstrak arsip Moodle, memindahkan file `.tgz` ke `/etc`, mengeluarkan seluruh isi folder `moodle` ke `/var/www/html`, dan mengecek hasilnya dengan `ls`.

3. **Langkah 3: Pembuatan Direktori `moodledata` & Pengaturan Permission**
   - **Blok Kode CLI (Sebelum Gambar):**
     ```bash
     mkdir -p /var/www/moodledata
     chown -R www-data:www-data /var/www/html
     chown -R www-data:www-data /var/www/moodledata
     chmod -R 770 /var/www/moodledata
     chmod -R 755 /var/www/html
     ```
   - **Gambar:** `assets/6-Web_server/3-moodle-permission.png`
   - **Penjelasan:** Membuat folder `/var/www/moodledata` dan mengatur hak akses (*owner* dan *permission*) untuk `www-data`.

### 6.2 Konfigurasi VirtualHost Apache2 & Parameter `php.ini`
4. **Langkah 4: Mengubah DocumentRoot Apache2**
   - **Blok Kode CLI (Sebelum Gambar):**
     ```bash
     nano /etc/apache2/sites-available/000-default.conf
     ```
   - **Gambar:** `assets/6-Web_server/4-apache2-doc-root.png`
   - **Penjelasan:** Mengubah arah `DocumentRoot` menjadi `/var/www/html/public`.

5. **Langkah 5: Mengatur `max_input_vars` pada `php.ini` & Restart Apache2**
   - **Blok Kode CLI (Sebelum Gambar):**
     ```bash
     nano /etc/php/8.2/apache2/php.ini
     ```
   - **Gambar:** `assets/6-Web_server/5-php-max-input-vars.png`
   - **Penjelasan:** Menghapus tanda komentar (`;`) pada `max_input_vars` dan mengubah nilainya menjadi `5000`.
   - **Blok Kode CLI (Sesudah Gambar):**
     ```bash
     systemctl restart apache2
     ```

### 6.3 Instalasi Moodle Melalui Web Browser
6. **Gambar:** `assets/6-Web_server/6-buka-moodle.png` — Membuka browser dan mengakses IP VM Web Server (`http://192.168.xx.2`), lalu memilih bahasa instalasi.
7. **Gambar:** `assets/6-Web_server/7-moodle-directory.png` — Konfirmasi lokasi direktori Moodle dan `moodledata`, lalu klik **Next**.
8. **Gambar:** `assets/6-Web_server/8-database-type.png` — Memilih tipe driver database **MariaDB (native/mariadb)**.
9. **Gambar:** `assets/6-Web_server/9-database-config.png` — Mengisi informasi koneksi database sesuai yang telah dibuat (Database host: IP `db_server`, Database name: `moodle`, Database user: `moodleuser`, Password: `1`).
10. **Gambar:** `assets/6-Web_server/10-license.png` — Menyetujui lisensi penggunaan Moodle (**Continue**).
11. **Gambar:** `assets/6-Web_server/11-continue.png` — Memastikan pengecekan sistem terpenuhi lalu klik **Continue**.
12. **Gambar:** `assets/6-Web_server/12-installation-complete.png` — Menunggu proses instalasi modul selesai lalu klik **Continue**.
13. **Gambar:** `assets/6-Web_server/13-admin.png` — Mengisi nama admin, password, dan email admin untuk login utama.
14. **Gambar:** `assets/6-Web_server/14-site-name.png` — Mengisi nama situs (*Full site name* dan *Short name*).
15. **Gambar:** `assets/6-Web_server/15-email-no-reply.png` — Mengisi *Support email* dan *No-reply address*.

### 6.4 Pengujian Pembuatan Course, User & Enrolment
16. **Gambar:** `assets/6-Web_server/16-make-course.png` — Membuat course baru di Moodle.
17. **Gambar:** `assets/6-Web_server/17-user.png` — Masuk ke menu **Site administration > Users > Add a new user**.
18. **Gambar:** `assets/6-Web_server/18-new-user.png` — Mengisi *Username* dan *Password* untuk user baru.
19. **Gambar:** `assets/6-Web_server/19-new-user-2.png` — Mengisi *First name*, *Last name*, dan *Email address* pada halaman yang sama lalu menyimpan user.
20. **Gambar:** `assets/6-Web_server/20-created-user.png` — Tampilan hasil pembuatan user baru pada daftar pengguna.
21. **Gambar:** `assets/6-Web_server/21-user-regist.png` — Masuk ke **Site administration > Courses > Manage courses and categories** untuk memasukkan user ke dalam course.
22. **Gambar:** `assets/6-Web_server/22-user-enrolled.png` — Memilih course yang dibuat lalu membuka menu **Enrol users**.
23. **Gambar:** `assets/6-Web_server/23-enroll-user.png` — Mencari user yang telah dibuat lalu melakukan *Enrol* ke dalam course.

### 6.5 Konfigurasi Akses Eksternal (`HTTP_HOST`) & Pengujian Port Forwarding
24. **Langkah 6: Membuka File `config.php` Moodle**
    - **Blok Kode CLI (Sebelum Gambar):**
      ```bash
      nano /var/www/html/config.php
      ```
    - **Gambar:** `assets/6-Web_server/24-config-php-ext.png`
    - **Penjelasan:** Membuka file `/var/www/html/config.php` untuk menyesuaikan pengaturan alamat akses web (`wwwroot`).

25. **Langkah 7: Mengubah `$CFG->wwwroot` Menjadi Dinamis**
    - **Gambar:** `assets/6-Web_server/25-ext-access.png`
    - **Penjelasan:** Mengubah baris `$CFG->wwwroot = 'http://192.168.3.2';` menjadi `'http://' . $_SERVER['HTTP_HOST'];` agar Moodle dapat diakses dari jaringan lokal maupun eksternal.
    - **Blok Kode CLI (Sesudah Gambar):**
      ```php
      $CFG->wwwroot = 'http://' .$_SERVER['HTTP_HOST'];
      ```
      ```bash
      systemctl restart apache2
      ```

26. **Langkah 8: Uji Akses dari `ext-client` (Port 9090)**
    - **Gambar:** `assets/6-Web_server/26-ext-client-access.jpeg`
    - **Penjelasan:** Percobaan akses dari jaringan luar menggunakan alamat `http://10.10.10.3:9090` dan berhasil masuk ke tampilan halaman login Moodle.

---

## Bagian 7: Otomatisasi Backup dengan Bash Script & Cronjob (`assets/7-Backup/`)

### 7.1 Konfigurasi Otomatisasi Backup pada VM Web Server
1. **Langkah 1: Membuat Script Backup Web Server (`backup_web.sh`)**
   - **Blok Kode CLI (Sebelum Gambar):**
     ```bash
     nano /usr/local/bin/backup_web.sh
     ```
   - **Gambar:** `assets/7-Backup/1-web-backup-sh.png`
   - **Penjelasan:** Isi skrip `/usr/local/bin/backup_web.sh` untuk mem-backup dan mengompresi file konfigurasi serta data web server ke direktori `/backup`.
   - **Blok Kode CLI (Sesudah Gambar):**
     Memberikan izin eksekusi (*executable*) pada skrip backup lalu di jalankan manual untuk check:
     ```bash
     chmod +x /usr/local/bin/backup_web.sh
     /usr/local/bin/backup_web.sh
     ```

2. **Langkah 2: Menjadwalkan Backup Web Server di Crontab**
   - **Blok Kode CLI (Sebelum Gambar):**
     Membuka konfigurasi penjadwalan cronjob (pilih `1` untuk editor `nano`):
     ```bash
     crontab -e
     ```
   - **Gambar:** `assets/7-Backup/2-web-crontab.png`
   - **Penjelasan:** Menambahkan baris penjadwalan cronjob otomatis untuk menjalankan `/usr/local/bin/backup_web.sh`.

3. **Langkah 3: Validasi Hasil Backup Web Server**
   - **Blok Kode CLI (Sebelum Gambar):**
     ```bash
     ls /backup
     ```
   - **Gambar:** `assets/7-Backup/3-web-result.png`
   - **Penjelasan:** Mengecek isi direktori `/backup` untuk memastikan file arsip backup web server telah berhasil terbentuk.

### 7.2 Konfigurasi Otomatisasi Backup pada VM Database Server
4. **Langkah 4: Membuat Script Backup Database (`backup_db.sh`)**
   - **Blok Kode CLI (Sebelum Gambar):**
     ```bash
     nano /usr/local/bin/backup_db.sh
     ```
   - **Gambar:** `assets/7-Backup/4-db-backup-sh.png`
   - **Penjelasan:** Isi skrip `/usr/local/bin/backup_db.sh` untuk mem-backup database Moodle ke dalam direktori `/backup`.
   - **Blok Kode CLI (Sesudah Gambar):**
     Memberikan izin eksekusi pada skrip backup database lalu di jalankan manual untuk check:
     ```bash
     chmod +x /usr/local/bin/backup_db.sh
     /usr/local/bin/backup_db.sh
     ```

5. **Langkah 5: Menjadwalkan Backup Database di Crontab**
   - **Blok Kode CLI (Sebelum Gambar):**
     Membuka konfigurasi cronjob (pilih `1` untuk menggunakan editor `nano`):
     ```bash
     crontab -e
     ```
   - **Gambar:** `assets/7-Backup/5-db-crontab.png`
   - **Penjelasan:** Menambahkan jadwal cronjob otomatis untuk mengeksekusi `/usr/local/bin/backup_db.sh`.

6. **Langkah 6: Validasi Hasil Backup Database**
   - **Blok Kode CLI (Sebelum Gambar):**
     ```bash
     ls /backup
     ```
   - **Gambar:** `assets/7-Backup/6-db-result.png`
   - **Penjelasan:** Mengecek isi direktori `/backup` pada `db_server` untuk memvalidasi bahwa file hasil backup database sudah tersimpan.