# ChatApp Mobile Application 📱

A modern, real-time chat application built with React Native (Expo) featuring WhatsApp-style typing indicators, real-time messaging, and seamless user experience.

## ✨ Features

- **Real-time Messaging** 💬
  - Instant message delivery using Socket.IO
  - Real-time typing indicators (like WhatsApp)
  - Message read status tracking
  - Unread message counts

- **User Authentication** 🔐
  - User registration and login
  - JWT token-based authentication
  - Secure user sessions

- **Modern UI/UX** 🎨
  - Clean, intuitive interface
  - Responsive design for all screen sizes
  - Smooth animations and transitions
  - Dark/Light theme support

- **Real-time Status** 📊
  - Online/Offline user status
  - Last seen timestamps
  - Typing indicators in real-time

## 🚀 Tech Stack

- **Frontend Framework**: React Native with Expo
- **Real-time Communication**: Socket.IO client
- **State Management**: React Hooks (useState, useEffect, useRef)
- **Navigation**: Expo Router
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT tokens
- **Styling**: React Native StyleSheet

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (for iOS development)
- Android Studio (for Android development)
- Supabase account and project
- PostgreSQL knowledge (basic)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Yenganollarajesh/mobile.git
   cd mobile
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   - Create a `.env` file in the root directory
   - Add your Supabase configuration:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   EXPO_PUBLIC_SERVER_URL=your_server_url
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

## 🗄️ Database Setup & Configuration

### Option 1: Supabase (Recommended) ☁️

Supabase provides a managed PostgreSQL database with real-time capabilities, perfect for chat applications.

#### Supabase Project Setup
1. **Create Supabase Project**
   - Visit [supabase.com](https://supabase.com)
   - Sign up/Login and create a new project
   - Wait for project initialization (usually 2-3 minutes)

2. **Get Project Credentials**
   - Go to **Settings** → **API**
   - Copy your project URL and API keys:
     - `Project URL`: Your Supabase project URL
     - `anon public`: Public API key for client-side
     - `service_role`: Service role key for server-side (keep secret)

3. **Update Environment Variables**
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

4. **Database Schema Setup**
   - Go to **SQL Editor** in your Supabase dashboard
   - Run the schema script from `../server/supabase-setup.sql`
   - This creates all necessary tables and functions

#### Supabase Features for ChatApp
- **Real-time Subscriptions**: Live message updates
- **Row Level Security (RLS)**: Secure data access
- **Built-in Authentication**: User management
- **Automatic Backups**: Data safety
- **Database Functions**: Custom logic for chat features

### Option 2: Local PostgreSQL Development 🖥️

For development or self-hosted environments, you can use local PostgreSQL.

#### Local PostgreSQL Installation

**Windows:**
1. Download PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run the installer and follow the setup wizard
3. Remember the password you set for the `postgres` user
4. Add PostgreSQL to your PATH environment variable
5. Install pgAdmin for database management (optional)

**macOS:**
```bash
# Using Homebrew
brew install postgresql
brew services start postgresql

# Or using Postgres.app (recommended for development)
# Download from https://postgresapp.com/
# Drag to Applications folder and double-click to start
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Local Database Setup
1. **Create Database and User**
   ```bash
   # Connect to PostgreSQL as postgres user
   sudo -u postgres psql
   
   # Create database and user
   CREATE DATABASE chatapp;
   CREATE USER chatapp_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE chatapp TO chatapp_user;
   
   # Exit psql
   \q
   ```

2. **Run Schema Scripts**
   ```bash
   # Connect to your database
   psql -h localhost -U chatapp_user -d chatapp
   
   # Run the setup script from server directory
   \i ../server/setup-db.sql
   ```

3. **Update Server Configuration**
   - In your server's `config.env`:
   ```env
   DB_HOST=localhost
   DB_NAME=chatapp
   DB_USER=chatapp_user
   DB_PASSWORD=your_secure_password
   DB_PORT=5432
   ```

### Database Schema Overview

#### Core Tables
```sql
-- Users table for authentication and profiles
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_online BOOLEAN DEFAULT FALSE
);

-- Conversations between users
CREATE TABLE conversations (
  id BIGSERIAL PRIMARY KEY,
  user1_id BIGINT REFERENCES users(id),
  user2_id BIGINT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message TEXT,
  last_message_time TIMESTAMP,
  last_message_sender_id BIGINT REFERENCES users(id)
);

-- Individual messages in conversations
CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT REFERENCES conversations(id),
  sender_id BIGINT REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP
);
```

#### Performance Indexes
```sql
-- Create indexes for better query performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_conversations_users ON conversations(user1_id, user2_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at);
```

### Database Connection Testing

#### Test Supabase Connection
```bash
# Test using the server's test script
cd ../server
node test-connection.js
```

#### Test Local PostgreSQL Connection
```bash
# Test connection from command line
psql -h localhost -U chatapp_user -d chatapp -c "SELECT version();"

# Test using the server's database check script
cd ../server
node check-db.js
```

### Database Management Commands

#### Basic PostgreSQL Commands
```sql
-- List all databases
\l

-- Connect to a database
\c database_name

-- List all tables
\dt

-- Describe table structure
\d table_name

-- List all users
\du

-- Exit psql
\q
```

#### Database Operations
```sql
-- Create a new database
CREATE DATABASE database_name;

-- Drop a database
DROP DATABASE database_name;

-- Backup database
pg_dump -h localhost -U username database_name > backup.sql

-- Restore database
psql -h localhost -U username database_name < backup.sql
```

## 📱 Running the App

### iOS Simulator
```bash
npm run ios
```

### Android Emulator
```bash
npm run android
```

### Web Browser
```bash
npm run web
```

## 🏗️ Project Structure

```
mobile/
├── app/                    # Main application screens
│   ├── (tabs)/           # Tab-based navigation
│   │   ├── index.tsx     # Conversations list
│   │   ├── explore.tsx   # Explore screen
│   │   └── users.tsx     # Users list
│   ├── chat/             # Chat functionality
│   │   └── [id].tsx      # Individual chat screen
│   ├── login.tsx         # Login screen
│   └── register.tsx      # Registration screen
├── components/            # Reusable UI components
│   ├── Login.tsx         # Login component
│   ├── RegisterScreen.tsx # Registration component
│   └── ThemedText.tsx    # Themed text component
├── services/              # API and service layer
│   ├── api.ts            # API configuration
│   ├── socket.ts         # Socket.IO client service
│   ├── conversations.ts  # Conversation API calls
│   └── users.ts          # User API calls
├── config/                # Configuration files
│   └── server.ts         # Server configuration
├── constants/             # App constants
│   └── Colors.ts         # Color definitions
└── hooks/                 # Custom React hooks
    ├── useColorScheme.ts # Theme management
    └── useThemeColor.ts  # Color utilities
```

## 🔧 Configuration

### Supabase Setup
1. Create a new Supabase project
2. Run the SQL scripts from `../server/supabase-setup.sql`
3. Update environment variables with your Supabase credentials
4. Configure Row Level Security policies

### Server Configuration
- Ensure your backend server is running
- Update `config/server.ts` with correct server URL
- Verify Socket.IO connection settings
- Test database connectivity

### Environment Variables
```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Server Configuration
EXPO_PUBLIC_SERVER_URL=your_server_url

# Optional: Development overrides
EXPO_PUBLIC_DEBUG_MODE=true
EXPO_PUBLIC_LOG_LEVEL=debug
```

## 📱 Key Components

### Conversation List (`app/(tabs)/index.tsx`)
- Displays all user conversations
- Real-time unread count updates
- Typing indicators
- Online/offline status

### Chat Screen (`app/chat/[id].tsx`)
- Individual chat interface
- Real-time message updates
- Typing indicators
- Message read status

### Socket Service (`services/socket.ts`)
- Manages real-time connections
- Handles typing events
- Message synchronization
- User status updates

## 🚀 Features in Detail

### Real-time Typing Indicators
- Shows "typing..." when other users are typing
- Replaces "Online" status during typing
- Smooth transitions between states

### Message Management
- Instant message delivery
- Unread count tracking
- Message read status
- Conversation history

### User Experience
- Smooth navigation between screens
- Real-time updates without page refresh
- Responsive design for all devices
- Intuitive chat interface

## 🐛 Troubleshooting

### Common Issues

1. **Socket Connection Failed**
   - Check server URL in configuration
   - Verify server is running
   - Check network connectivity

2. **Supabase Connection Error**
   - Verify Supabase credentials
   - Check database schema setup
   - Ensure RLS policies are configured

3. **Build Errors**
   - Clear Metro cache: `npx expo start --clear`
   - Reinstall dependencies: `rm -rf node_modules && npm install`

4. **Database Connection Issues**
   - Verify database credentials
   - Check if database service is running
   - Ensure database schema is properly set up
   - Test connection using provided scripts

### Database-Specific Issues

1. **Supabase RLS Policy Errors**
   ```sql
   -- Check if RLS is enabled
   SELECT schemaname, tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename IN ('users', 'conversations', 'messages');
   
   -- Enable RLS if needed
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
   ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
   ```

2. **Local PostgreSQL Connection Issues**
   - Verify PostgreSQL service is running
   - Check connection credentials
   - Ensure database exists
   - Check firewall settings

3. **Schema Migration Issues**
   - Run schema scripts in correct order
   - Check for existing tables/conflicts
   - Verify user permissions

### Debug Mode
```bash
# Enable debug logging
EXPO_PUBLIC_DEBUG_MODE=true npm start

# Check database connection
cd ../server && node check-db.js

# Test Supabase connection
cd ../server && node test-connection.js
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- **Repository**: https://github.com/Yenganollarajesh/mobile.git
- **Backend Server**: https://github.com/Yenganollarajesh/server.git
- **Supabase**: https://supabase.com/
- **PostgreSQL**: https://www.postgresql.org/
- **Expo**: https://expo.dev/

## 📞 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Review the Supabase setup documentation
- Check PostgreSQL documentation for database issues

---

**Built with ❤️ using React Native and Expo**
