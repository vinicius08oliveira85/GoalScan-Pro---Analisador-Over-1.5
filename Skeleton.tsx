import React from 'react';

export const SkeletonMatchCard = () => (
  <div className="custom-card p-4 flex flex-col gap-4 animate-pulse">
    <div className="h-4 bg-base-300 rounded w-1/2"></div>
    <div className="h-6 bg-base-300 rounded w-3/4"></div>
    <div className="h-4 bg-base-300 rounded w-full"></div>
    <div className="border-t border-base-300 pt-3 flex justify-between items-center">
       <div className="h-8 bg-base-300 rounded w-20"></div>
       <div className="h-8 bg-base-300 rounded w-16"></div>
    </div>
  </div>
);