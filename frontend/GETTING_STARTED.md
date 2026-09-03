# Getting Started with Niro

## Quick Start (5 minutes)

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

The application will open at **http://localhost:3000**

### 3. Login
Use any credentials in development mode:
- **Email**: `analyst@niro.dev` (or any email)
- **Password**: `password` (or any password)

The mock API will automatically log you in.

---

## What You'll See

### Landing Page: Login
- Professional Niro branding
- Left side: Brand identity with lavender accent
- Right side: Login form
- Links to register and password recovery

### Main Dashboard
After login, you'll see:
- **Top Bar**: Merchant selector (ACME STORE), TEST ENVIRONMENT badge, theme toggle, user profile
- **Sidebar**: Navigation sections (Overview, Investigate, Measure, System)
- **Dashboard Content**:
  - 4 KPI cards (Transactions, High-Risk Customers, Clusters, Investigations)
  - Detection performance metrics (Precision 70.9%, Recall 84.7%)
  - Risk distribution pie chart
  - Signal distribution bar chart
  - Suspicious clusters table
  - Investigation queue

### Try These Features

#### 1. **Browse Customers**
- Click "Customers" in sidebar
- Search for customers by name
- Filter by risk level
- Click any customer to see detailed risk assessment

#### 2. **View Customer Risk Analysis**
- In customer detail, see:
  - Risk score (0-100)
  - Risk signals with evidence
  - Observed vs. baseline values
  - AI-generated assessment
  - Honest limitations disclaimer

#### 3. **Check Evaluation Metrics**
- Click "Evaluation" in sidebar
- See honest limitations banner (synthetic data)
- Review confusion matrix
- Check signal performance
- Browse false positive examples

#### 4. **Switch Themes**
- Click sun/moon icon in sidebar
- Or go to Settings → Appearance
- Try Light, Dark, and System modes
- Notice the cool gray/blue light theme (not pure white!)

---

## Understanding the Mock Data

The application includes **realistic synthetic data**:

### Customers (50)
- **Low Risk (50%)**: Normal transaction patterns
- **Medium Risk (30%)**: Some suspicious signals
- **High Risk (15%)**: Multiple risk indicators
- **Critical Risk (5%)**: Severe fraud patterns

### Risk Signals Detected
1. **Refund Velocity** - Unusual refund request rate
2. **Transaction Velocity** - Rapid transaction patterns
3. **Device Reuse** - Multiple accounts on same device
4. **IP Reuse** - Multiple accounts from same IP
5. **Amount Similarity** - Coordinated transaction amounts
6. **Coordinated Activity** - Temporal clustering

### Evaluation Data
- **Dataset**: 1,000 synthetic transactions
- **Positive Cases**: 150 (fraud)
- **Negative Cases**: 850 (legitimate)
- **Performance**: 70.9% precision, 84.7% recall
- **False Positives**: 52 cases with explanations

---

## Key Pages Tour

### 📊 Dashboard (`/dashboard`)
**Purpose**: High-level risk operations overview

**What to look for**:
- Real-time KPI cards
- Performance metrics with "SYNTHETIC EVALUATION DATA" labels
- Interactive charts (click legends to filter)
- Quick links to detail pages

### 👥 Customers (`/customers`)
**Purpose**: Monitor customer risk profiles

**Features**:
- Search by name, ID, or email
- Filter by risk level
- Sort by any column
- Click customer name for details

**Try searching**: "Sarah Chen" or "Michael"

### 👤 Customer Detail (`/customers/CUST-00001`)
**Purpose**: Deep dive into individual risk

**Sections**:
1. **Risk Summary**: Score, level, key metrics
2. **Risk Signals**: Evidence-based detection
3. **AI Assessment**: Reasoning with limitations

**Notice**: Every signal shows observed vs. baseline!

### 📈 Evaluation (`/evaluation`)
**Purpose**: Honest detector performance

**Key elements**:
1. **Limitations Banner**: "This evaluation uses synthetic data..."
2. **Confusion Matrix**: Visual TP/TN/FP/FN breakdown
3. **Signal Performance**: Per-signal precision/recall
4. **False Positives**: Real examples with reasons

**This is not a typical dashboard** - it shows honest limitations!

### ⚙️ Settings (`/settings`)
**Purpose**: Profile and preferences

**Options**:
- View profile info
- Switch themes (Light/Dark/System)

---

## Theme Showcase

### Light Theme
- **Background**: Cool gray/blue (#F3F6F8) - NOT pure white
- **Surfaces**: White cards with subtle shadows
- **Accent**: Darker lavender for contrast
- **Feel**: Professional, comfortable, LinkedIn-inspired

### Dark Theme
- **Background**: Deep charcoal (#212121)
- **Surfaces**: Lighter charcoal cards
- **Accent**: Lighter lavender for visibility
- **Feel**: Modern, elegant, easy on eyes

### System Theme
- Automatically matches your OS preference
- Seamless switching
- Same design, different colors

---

## Architecture Highlights

### Frontend Stack
```
React 18 + TypeScript 5
├── Vite (lightning-fast builds)
├── React Router (client-side routing)
├── TanStack Query (server state)
├── Tailwind CSS (utility-first styling)
├── Recharts (data viz)
└── Lucide React (icons)
```

### Code Structure
```
src/
├── pages/           # Route components
├── components/      # Reusable UI
├── contexts/        # Auth, Theme
├── services/api/    # Data layer
├── types/           # TypeScript types
└── lib/             # Utilities
```

### Mock API
- Located in `src/services/api/mockData.ts`
- 50 customers, 200 transactions, 12 clusters
- Realistic risk distributions
- Configurable via `MOCK_API_ENABLED` flag

---

## Development Tips

### Hot Module Replacement
- Edit any component
- See changes instantly
- No page refresh needed

### Type Safety
- All data is typed
- Autocomplete everywhere
- Catch errors at compile time

### Component Reuse
```typescript
// Use pre-built components
import { Card, Badge, Table } from '@/components/ui'

// Risk-aware badge
<Badge variant="risk" riskLevel="HIGH">HIGH RISK</Badge>

// Professional table
<Table>...</Table>
```

### API Integration
To connect to real backend:
1. Set `MOCK_API_ENABLED = false`
2. Configure `VITE_API_URL`
3. Backend must implement matching endpoints

---

## Common Questions

### Q: Why does the light theme use gray instead of white?
**A**: Professional fintech applications avoid pure white backgrounds. The cool gray/blue (#F3F6F8) is easier on eyes during long analyst sessions, similar to LinkedIn's professional palette.

### Q: Where's the AI chat interface?
**A**: Niro is **not** a ChatGPT clone. It's a risk operations console. AI assists with evidence analysis but doesn't provide conversational chat. This is intentional.

### Q: Can I see real fraud data?
**A**: No. All data is synthetic. The evaluation page clearly states this with an honest limitations banner. Real fraud detection requires real merchant data and ML models.

### Q: Why show false positives?
**A**: Transparency. Every detector has false positives. Showing them with reasons (VPN usage, bulk purchasing, family sharing) builds trust and helps analysts understand system behavior.

### Q: Is this production-ready?
**A**: The **frontend** is production-quality TypeScript React code. It needs:
- Real backend API
- Real authentication
- Real fraud detection ML
- Production deployment infrastructure

---

## Next Steps

### For Development
1. Explore the codebase
2. Add new pages (Transactions, Clusters, etc.)
3. Connect to Spring Boot backend
4. Customize styling

### For Demo
1. Start dev server (`npm run dev`)
2. Open in browser
3. Login with any credentials
4. Show Dashboard → Customers → Evaluation flow
5. Emphasize honest limitations and evidence transparency

### For Deployment
```bash
npm run build
# Upload dist/ folder to hosting
# Configure environment variables
# Set up reverse proxy to backend
```

---

## Troubleshooting

### Build fails
```bash
# Clear cache and reinstall
rm -rf node_modules dist
npm install
npm run build
```

### Port already in use
```bash
# Vite will auto-increment
# Or manually change in vite.config.ts
server: { port: 3001 }
```

### Theme not switching
- Check browser console for errors
- Ensure localStorage is enabled
- Try clearing browser cache

---

## Resources

- **README.md**: Technical documentation
- **PROJECT_SUMMARY.md**: Complete feature list
- **Source Code**: Well-commented throughout
- **TypeScript Types**: `src/types/index.ts`

---

## Support

This is a hackathon project for **Track 02: AI Risk Manager**.

For questions about:
- **Design decisions**: See PROJECT_SUMMARY.md
- **Technical implementation**: See inline code comments
- **Business logic**: See risk signal implementations
- **Evaluation methodology**: See Evaluation page documentation

---

## Credits

Built with ❤️ for fintech risk operations teams.

**Not** your typical AI dashboard. **Actually** designed for merchant fraud detection.
