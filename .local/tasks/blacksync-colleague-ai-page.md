# Blacksync Colleague AI Trading Page

## What & Why
Add a new "/ai" page featuring "Blacksync Colleague" — an AI-powered trading expert assistant built into the platform. It analyzes the logged-in user's actual trade history from the database, calculates ROI, identifies patterns and issues in their trading, and gives honest, direct feedback. This gives traders a powerful tool to improve their performance using their own real data.

## Done looks like
- A new page at `/ai` accessible from the app navigation, styled consistently with the existing dark fintech theme
- A chat-style interface where users can converse with Blacksync Colleague
- The AI has access to the user's trade history (from the `trades` table) and account info, and uses it to provide real analysis
- The AI can calculate ROI, win rate, average P&L, risk/reward ratios, and identify problematic patterns (e.g., overtrading, poor stop-loss placement, instrument-specific issues)
- Pre-built quick-action buttons for common queries like "Analyze my trades", "Calculate my ROI", "Show my biggest issues", "Best/worst instruments"
- The AI is direct and honest — it doesn't sugarcoat poor performance
- Includes the attached macOS-style menu bar component at the top of the page
- Requires user to be logged in (uses existing auth)

## Out of scope
- Providing live trade signals or recommendations to enter specific trades
- Integration with external AI APIs beyond what's needed for the chat (use OpenAI)
- Storing chat history in the database (session-only for now)

## Tasks
1. Install the OpenAI package and set up a server-side AI chat endpoint that receives user messages along with their trade data context, and returns AI responses with a trading-expert system prompt
2. Create the Blacksync Colleague page with a chat interface — dark themed to match the platform, with the macOS menu bar component integrated at the top
3. Build trade analysis utilities on the backend that compute key metrics (ROI, win rate, avg P&L, risk/reward, per-instrument breakdown, streaks) from the user's trades and inject them as context for the AI
4. Add quick-action buttons on the chat UI for common analyses (ROI calculation, trade issues, instrument breakdown, worst trades review)
5. Register the new `/ai` route in the app router and add navigation links to it from the dashboard

## Relevant files
- `client/src/App.tsx`
- `client/src/pages/dashboard.tsx`
- `shared/schema.ts`
- `server/routes.ts`
- `server/storage.ts`
- `attached_assets/Pasted-You-are-given-a-task-to-integrate-an-existing-React-com_1773260915270.txt`
