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

### Server Configuration
- Ensure your backend server is running
- Update `config/server.ts` with correct server URL
- Verify Socket.IO connection settings

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

## 📞 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Review the Supabase setup documentation

---

**Built with ❤️ using React Native and Expo**
