# Niro - Risk Intelligence Platform (Frontend)

A production-quality fintech risk intelligence platform for detecting coordinated abuse and fraud patterns.

## 🚀 Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Routing
- **TanStack Query** - Server state management
- **Tailwind CSS** - Styling
- **Recharts** - Data visualizations
- **Lucide React** - Icons
- **Zod** - Schema validation

## 🎨 Features

### Authentication
- ✅ Login / Register
- ✅ Email verification
- ✅ Password reset flow
- ✅ Protected routes
- ✅ Mock API with realistic data

### Dual Theme Support
- ✅ **Light Theme**: Cool gray/blue professional palette (#F3F6F8)
- ✅ **Dark Theme**: Charcoal foundation (#212121)
- ✅ **System Theme**: Auto-detect user preference
- ✅ Lavender brand accent (#8A84E6)

### Core Pages

#### Dashboard
- KPI cards (transactions, high-risk customers, clusters, investigations)
- Detection performance metrics (precision, recall)
- Risk distribution pie chart
- Signal distribution bar chart
- Suspicious clusters table
- Investigation queue

#### Customers
- Searchable customer list
- Risk level filtering
- Detailed customer view with:
  - Risk assessment summary
  - Risk signals with evidence
  - AI-generated assessment with limitations
  - Contribution scoring

#### Evaluation
- Dataset metrics
- Performance metrics (precision, recall, F1, FP rate)
- Confusion matrix visualization
- Signal performance breakdown
- False positive examples
- **Honest limitations banner** about synthetic data

#### Settings
- Profile management
- Theme selector (Light/Dark/System)

### UI Components
- Card, Badge, Button, Input, Table
- Risk-level color coding
- Professional data tables
- Responsive layouts
- Loading states

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── components/
│   │   ├── auth/          # Protected routes
│   │   ├── brand/         # Logo components
│   │   ├── layout/        # AppLayout with sidebar
│   │   └── ui/            # Reusable UI components
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── ThemeContext.tsx
│   ├── lib/
│   │   └── utils.ts       # Formatting, colors
│   ├── pages/
│   │   ├── auth/          # Login, Register, etc.
│   │   ├── Dashboard.tsx
│   │   ├── Customers.tsx
│   │   ├── CustomerDetail.tsx
│   │   ├── Evaluation.tsx
│   │   └── Settings.tsx
│   ├── services/
│   │   └── api/           # API layer with mock data
│   └── types/
│       └── index.ts       # TypeScript definitions
└── ...
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🔐 Mock Authentication

In development mode with mock API enabled:

- **Email**: Any valid email format
- **Password**: Any password (min 8 characters for registration)

The app will auto-login with a mock user profile.

## 🎯 Key Design Principles

1. **Professional Fintech Aesthetic** - Serious risk operations console, not a generic dashboard
2. **Dual Theme Support** - Light theme uses cool gray/blue (#F3F6F8), NOT pure white
3. **Information Density** - Optimized for analyst workflows
4. **Honest Evaluation** - Clear disclaimers about synthetic data limitations
5. **Evidence-Based** - Risk signals show observed vs. baseline values
6. **AI Transparency** - AI assessments clearly labeled with confidence and limitations

## 📊 Mock Data

The application includes realistic mock data:
- 50 customers with varying risk profiles
- 200 transactions
- 12 risk clusters
- 25 investigations
- Complete evaluation metrics with confusion matrix

## 🎨 Brand Identity

- **Product Name**: NIRO
- **Primary Color**: Lavender (#8A84E6)
- **Logo**: Geometric white/navy diagonal with vertical lavender bars
- **Visual Identity**: Restrained, technical, trustworthy

## 🔄 API Integration

Currently using mock API (`MOCK_API_ENABLED = true`). To connect to Spring Boot backend:

1. Set `MOCK_API_ENABLED = false` in `src/services/api/client.ts`
2. Configure `VITE_API_URL` environment variable
3. Backend should be available at `http://localhost:8080`

## 📝 Environment Variables

Create `.env` file:

```env
VITE_API_URL=http://localhost:8080/api
```

## 🏗️ Build Output

Production build generates:
- Optimized JavaScript bundle (~730KB minified)
- CSS bundle with design tokens (~27KB)
- All assets properly hashed for caching

## 🚧 Roadmap / Not Yet Implemented

- Transactions list and detail pages
- Risk Clusters with React Flow graph
- Investigations management
- Audit Trail
- Dataset management
- Mobile responsive refinements
- Advanced filtering and sorting
- Bulk operations

## 📄 License

Proprietary - Track 02: AI Risk Manager Hackathon Project
