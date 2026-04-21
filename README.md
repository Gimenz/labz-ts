# labz-ts

> A powerful self-bot for WhatsApp built with TypeScript, for your daily assistant.

![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=flat&logo=node.js)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)
![Status](https://img.shields.io/badge/Status-Active-success?style=flat)

## 📋 Project Overview

**labz-ts** is a sophisticated WhatsApp self-bot written in TypeScript that can help your daily life.

### Key Capabilities

- Object-Oriented implemented @discord.js/collection
- Social Media Downloaders
- Finance Assistant
- WA Status detection -> download it


### Key Dependencies

- `@whiskeysockets/baileys` - WhatsApp Web client library
- `@prisma/client` - Database ORM
- `better-sqlite3` - SQLite driver
- `@google/generative-ai` - AI integration
- `insta-fetcher` - Instagram content fetching
- `google-spreadsheet` - Google Sheets for save finance report

## ✨ Key Features

### General Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `menu` | `mnu`, `m`, `help` | Display command menu |
| `ping` | - | Check bot responsiveness |
| `stat` | `stats` | View bot/server statistics |

### Utility Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `afk` | - | Set/unset AFK status with duration tracking |
| `getstory` | `get`, `gs` | Download WA stories |
| `detectstory` | `ds` | Enable/disable automatic WA stories detection |
| `view` | `v`, `vi` | expose view once messages |
| `deleted` | - | Retrieve deleted messages on (this) chat |

### Downloader Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `igdp` | `igprofile` | Download Instagram profile pictures (HD quality) |
| `tiktok` | `t`, `tt` | Download TikTok videos (prefer on highest quality) |

### Finance Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `fin` | `finance` | record financial transactions (supports text and receipt images) |
| `budget` | `-` | set budget per category | |
| `kategori` | `-` | get categories | |
| `report` | `-` | get a summary report of transactions | |

**Finance Features:**
- Receipt image recognition using Google Gemini
- Transaction categorization
- Spending analysis
- Support for both manual text entry and photo-based recording

## 📦 Installation & Setup

### Prerequisites

- **Node.js** 20 or higher
- **npm** or **yarn** package manager
- **Git** (for cloning)

### 1. Clone Repository

```bash
git clone https://github.com/Gimenz/labz-ts.git
cd labz-ts
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup .env variables

```bash
cp .env.example .env
```
> open .env on text editor and fill any requirements 

### 4. Build n Run

```bash
npm run build
npm start

# or with pm2

pm2 start ecosystem.config.js
```

## License
MIT License - See LICENSE file.

Built with 
- [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)
- [insta-fetcher](https://github.com/Gimenz/insta-fetcher)


**use this project with your own discretion!**