import { Video, MousePointerClick, Clock, HardDrive } from 'lucide-react';
import { formatDuration, formatFileSize } from '@/renderer/lib/utils';

interface RecordingStatsProps {
  total: number;
  totalActions: number;
  totalDuration: number;
  totalVideoSize: number;
  totalSnapshotSize: number;
}

export function RecordingStats({ 
  total, 
  totalActions, 
  totalDuration, 
  totalVideoSize,
  totalSnapshotSize
}: RecordingStatsProps) {
  const totalStorageSize = totalVideoSize + totalSnapshotSize;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        icon={<Video className="w-5 h-5 text-blue-600" />}
        label="Total Recordings"
        value={total.toString()}
        bgColor="bg-blue-100 dark:bg-blue-900/30"
      />

      <StatCard
        icon={<MousePointerClick className="w-5 h-5 text-green-600" />}
        label="Total Actions"
        value={totalActions.toString()}
        bgColor="bg-green-100 dark:bg-green-900/30"
      />

      <StatCard
        icon={<Clock className="w-5 h-5 text-purple-600" />}
        label="Total Duration"
        value={formatDuration(totalDuration)}
        bgColor="bg-purple-100 dark:bg-purple-900/30"
      />

      <StatCard
        icon={<HardDrive className="w-5 h-5 text-orange-600" />}
        label="Storage Used"
        value={formatFileSize(totalStorageSize)}
        bgColor="bg-orange-100 dark:bg-orange-900/30"
        subtitle={totalSnapshotSize > 0 ? `${formatFileSize(totalSnapshotSize)} snapshots` : undefined}
      />
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  bgColor: string;
  subtitle?: string;
}

function StatCard({ icon, label, value, bgColor, subtitle }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2 ${bgColor} rounded-lg`}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
