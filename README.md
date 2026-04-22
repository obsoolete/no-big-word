# NO BIG WORD 🦖

A hilarious, fast-paced word-guessing game where you must describe complex concepts using only single-syllable words!

## 🎮 How to Play

1.  **Divide into Teams** or play in **Solo Mode** (up to 20 players/teams).
2.  **The Goal**: Earn points by getting your team (or others) to guess the word on your card.
3.  **The Rules of Speech**: You MUST only use words with **ONE SYLLABLE**.
    *   *Correct*: "Tube used to see far stars" (Telescope)
    *   *Wrong*: "Tube used to see planets" (**Plan-ets** has two syllables — **BOP!**)
4.  **The Bopper**: One player is designated as the "Bopper" each round. They have a (virtual) inflatable stick and will BOP you if you use a big word!

## 🚀 Features

-   **Team & Solo Modes**: Play with 2 to 20 participants.
-   **Specific Player Roles**: The game tracks whose turn it is to talk and who is the current bopper by name.
-   **Huge Word Library**: Over 700 curated word pairs (Easy 1pt words and 2-word Hard 3pt items).
-   **Vibrant UI**: Beautifully animated interface with a high-contrast palette.
-   **Dynamic Leaderboard**: Track scores and statistics (correct guesses vs. bops) throughout the game.

## 🛠️ Local Development

### Prerequisites
-   Node.js (v18+)
-   npm

### Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## 🐳 Hosting with Docker

You can easily host this app yourself using Docker.

### Using Docker Compose (Recommended)
```bash
docker-compose up -d --build
```
The app will be available at `http://localhost:8080`.

### Manual Docker Build
```bash
docker build -t no-big-word .
docker run -p 8080:80 no-big-word
```

## 📝 License
This project is licensed under the Apache-2.0 License.
