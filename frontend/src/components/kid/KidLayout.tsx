import { Outlet } from 'react-router-dom'
import KidSidebar from './KidSidebar'
import KidTopbar from './KidTopbar'

export default function KidLayout() {
  return (
    <div className="flex min-h-screen bg-primary-50">
      <KidSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <KidTopbar />
        <Outlet />
      </div>
    </div>
  )
}
