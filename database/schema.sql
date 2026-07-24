-- PulsePatrika — MySQL schema
-- Run:  mysql -u root -p < database/schema.sql
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS patrika_newsroom CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE patrika_newsroom;

-- ---------- Auth & roles ----------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(80) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  role          ENUM('Admin','Editor','Bureau Chief','HR','Legal','Management','Reporter') NOT NULL,
  edition       VARCHAR(60) DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS editions (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(60) UNIQUE NOT NULL
) ENGINE=InnoDB;

-- ---------- HR: employees (mirrors edit_hr.xlsx, all 28 columns) ----------
CREATE TABLE IF NOT EXISTS employees (
  sno               INT,
  employee_code     VARCHAR(40) PRIMARY KEY,
  vetan             DECIMAL(12,2),
  pan_no            VARCHAR(20),
  `groups`          VARCHAR(80),
  divisions         VARCHAR(80),
  teams             VARCHAR(80),
  cells             VARCHAR(80),
  level             VARCHAR(40),
  teams2            VARCHAR(80),
  total_rp          INT,
  total_db          INT,
  city_bureau_rp    INT,
  city_bureau_db    INT,
  diff_rp_db        INT,
  copy_potential    DECIMAL(10,2),
  category          VARCHAR(60),
  location          VARCHAR(80),
  employee_name     VARCHAR(160) NOT NULL,
  profile           VARCHAR(120),
  salary            DECIMAL(12,2),
  avg_pli           DECIMAL(6,2),
  grade             VARCHAR(20),
  salary_range      VARCHAR(60),
  mid_range_salary  DECIMAL(12,2),
  diff_actual_mid   DECIMAL(12,2),
  age               INT,
  qualification     VARCHAR(120),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- HR: notice / appreciation / warning log
CREATE TABLE IF NOT EXISTS hr_notices (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  employee_code VARCHAR(40),
  type          ENUM('Appreciation','Warning','Notice') NOT NULL,
  note          TEXT,
  score         INT DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_code) REFERENCES employees(employee_code) ON DELETE CASCADE
) ENGINE=InnoDB;

-- HR: skill training
CREATE TABLE IF NOT EXISTS skill_training (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  employee_code VARCHAR(40),
  skill         VARCHAR(120),
  status        ENUM('Assigned','In Progress','Completed') DEFAULT 'Assigned',
  certificate   VARCHAR(255),
  assessed_on   DATE
) ENGINE=InnoDB;

-- ---------- Editorial ----------
CREATE TABLE IF NOT EXISTS editorial_plan (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  edition     VARCHAR(60),
  title       VARCHAR(255) NOT NULL,
  reporter    VARCHAR(120),
  priority    ENUM('Breaking','Exclusive','Follow-up','Investigative'),
  status      ENUM('Draft','Assigned','In Progress','Approved') DEFAULT 'Draft',
  importance  INT DEFAULT 0,            -- AI story-importance rank
  plan_date   DATE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Content & AI quality ----------
CREATE TABLE IF NOT EXISTS news_content (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  edition         VARCHAR(60),
  reporter        VARCHAR(120),
  department      VARCHAR(60),
  headline        VARCHAR(255),
  body            MEDIUMTEXT,
  word_count      INT,
  front_page      TINYINT(1) DEFAULT 0,
  exclusive       TINYINT(1) DEFAULT 0,
  -- AI scores
  grammar_score       INT,
  headline_score      INT,
  readability_score   INT,
  sentiment           VARCHAR(20),
  fake_news_prob      DECIMAL(5,2),
  political_sensitive TINYINT(1) DEFAULT 0,
  legal_risk_words    TEXT,
  ai_summary          TEXT,
  ai_tags             VARCHAR(255),
  quality_grade       ENUM('A+','A','B','C'),
  published_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Production / page delay ----------
CREATE TABLE IF NOT EXISTS production_logs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  edition         VARCHAR(60),
  log_date        DATE,
  page_open       TIME,
  editing_done    TIME,
  pdf_export      TIME,
  plate_release   TIME,
  printing_done   TIME,
  delay_minutes   INT,
  sla_breached    TINYINT(1) DEFAULT 0,
  department      VARCHAR(60)
) ENGINE=InnoDB;

-- ---------- E-paper / page analytics ----------
CREATE TABLE IF NOT EXISTS epaper_pages (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  edition       VARCHAR(60),
  page_no       INT,
  page_date     DATE,
  ad_ratio      DECIMAL(5,2),
  news_ratio    DECIMAL(5,2),
  color_page    TINYINT(1) DEFAULT 0,
  ocr_text      MEDIUMTEXT,
  layout_flag   VARCHAR(255)
) ENGINE=InnoDB;

-- ---------- Legal ----------
CREATE TABLE IF NOT EXISTS legal_cases (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  case_no     VARCHAR(60) UNIQUE,
  edition     VARCHAR(60),
  court       VARCHAR(120),
  party       VARCHAR(160),
  advocate    VARCHAR(120),
  hearing     DATE,
  status      VARCHAR(40),
  risk        ENUM('Low','Medium','High') DEFAULT 'Low',
  documents   VARCHAR(255),
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Telegram send log
CREATE TABLE IF NOT EXISTS telegram_logs (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  alert_id          INT DEFAULT NULL,
  message           TEXT,
  chat_id           VARCHAR(80),
  status            ENUM('sent','failed') DEFAULT 'failed',
  telegram_response TEXT,
  sent_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Archive ----------
CREATE TABLE IF NOT EXISTS archive_videos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  event_name    VARCHAR(200),
  speaker       VARCHAR(120),
  department    VARCHAR(80),
  event_date    DATE,
  tags          VARCHAR(255),
  video_path    VARCHAR(255),
  transcript    LONGTEXT,
  summary       TEXT
) ENGINE=InnoDB;

-- ---------- Alerts ----------
CREATE TABLE IF NOT EXISTS alerts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  type        VARCHAR(40),
  severity    ENUM('low','med','high') DEFAULT 'low',
  message     VARCHAR(255),
  edition     VARCHAR(60),
  channel     VARCHAR(40),
  is_read     TINYINT(1) DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Calendar (prominent days) ----------
CREATE TABLE IF NOT EXISTS calendar_events (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200),
  event_date  DATE,
  category    VARCHAR(60),
  note        TEXT
) ENGINE=InnoDB;
