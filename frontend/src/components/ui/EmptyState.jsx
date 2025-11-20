import React from 'react';
import { Text } from './Typography';

export default function EmptyState({ 
  icon, 
  title, 
  description, 
  action 
}) {
  return (
    <div className="text-center py-12">
      {icon && (
        <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
          {icon}
        </div>
      )}
      <Text className="font-medium text-gray-900 mb-2">
        {title}
      </Text>
      <Text variant="muted" className="mb-6 max-w-sm mx-auto">
        {description}
      </Text>
      {action}
    </div>
  );
}
