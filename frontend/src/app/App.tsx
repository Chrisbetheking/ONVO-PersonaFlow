import { useEffect, useState } from 'react'
import { AppProvider } from './AppContext'
import { AppShell } from './AppShell'
import { parseRoute, type RouteState } from './router'
import { TodayPage } from '../pages/TodayPage'
import { StudioPage } from '../pages/StudioPage'
import { FollowUpPage } from '../pages/FollowUpPage'
import { ReviewPage } from '../pages/ReviewPage'
import { CampaignPage } from '../pages/CampaignPage'
import { AdvisorsPage } from '../pages/AdvisorsPage'
import { SettingsPage } from '../pages/SettingsPage'
import { AboutPage } from '../pages/AboutPage'
import { RadarPage } from '../pages/RadarPage'
import { KnowledgePage } from '../pages/KnowledgePage'
import { Customer360Page } from '../pages/Customer360Page'
import { PromisesPage } from '../pages/PromisesPage'
import { PolicyPage } from '../pages/PolicyPage'
import { QualityPage } from '../pages/QualityPage'
import { BestPracticesPage } from '../pages/BestPracticesPage'
import { CustomerRiskPage } from '../pages/CustomerRiskPage'
import { ExperimentsPage } from '../pages/ExperimentsPage'
import { GovernancePage } from '../pages/GovernancePage'

function RoutedApp() {
  const [route, setRoute] = useState<RouteState>(() => parseRoute())
  useEffect(() => {
    if (!window.location.hash) window.location.hash = '/today'
    const onHashChange = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  let page
  switch (route.id) {
    case 'studio': page = <StudioPage params={route.params} />; break
    case 'followup': page = <FollowUpPage params={route.params} />; break
    case 'customers': page = <Customer360Page />; break
    case 'promises': page = <PromisesPage />; break
    case 'review': page = <ReviewPage params={route.params} />; break
    case 'manager-radar': page = <RadarPage mode="manager" />; break
    case 'customer-risks': page = <CustomerRiskPage />; break
    case 'quality': page = <QualityPage />; break
    case 'hotspots': page = <RadarPage mode="hq" />; break
    case 'knowledge': page = <KnowledgePage />; break
    case 'policies': page = <PolicyPage />; break
    case 'best-practices': page = <BestPracticesPage />; break
    case 'experiments': page = <ExperimentsPage />; break
    case 'governance': page = <GovernancePage />; break
    case 'campaigns': page = <CampaignPage />; break
    case 'advisors': page = <AdvisorsPage />; break
    case 'settings': page = <SettingsPage />; break
    case 'about': page = <AboutPage />; break
    default: page = <TodayPage />
  }
  return <AppShell route={route.id}>{page}</AppShell>
}

export default function App() { return <AppProvider><RoutedApp /></AppProvider> }
