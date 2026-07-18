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
    case 'review': page = <ReviewPage />; break
    case 'campaigns': page = <CampaignPage />; break
    case 'advisors': page = <AdvisorsPage />; break
    case 'settings': page = <SettingsPage />; break
    case 'about': page = <AboutPage />; break
    default: page = <TodayPage />
  }

  return <AppShell route={route.id}>{page}</AppShell>
}

export default function App() {
  return <AppProvider><RoutedApp /></AppProvider>
}
