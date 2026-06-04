import { useTranslation } from 'react-i18next'
import KidSidebar from '../components/kid/KidSidebar'
import KidTopbar from '../components/kid/KidTopbar'
import TodaysTasks from '../components/kid/TodaysTasks'
import KidStats from '../components/kid/KidStats'
import { usePageTitle } from '../hooks/usePageTitle'

export default function ChildDashboard() {
  const { t } = useTranslation()
  usePageTitle(t('app.name'))

  return (
    <div className="flex min-h-screen bg-primary-50">

      <KidSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <KidTopbar />

        <main
          aria-labelledby="dashboard-heading"
          className="flex-1 p-6 grid grid-cols-3 gap-6 overflow-auto"
        >
          <div className="col-span-2">
            <TodaysTasks />
          </div>

          <div className="col-span-1">
            <KidStats />
          </div>
        </main>
      </div>

    </div>
  )
}
