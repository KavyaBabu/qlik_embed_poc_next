import { useEffect, useState } from 'react';

export const QlikSelections = ({ appId }: { appId: string }) => {
  const [isClient, setIsClient] = useState(false);

  const QlikEmbed = 'qlik-embed' as any;

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return <QlikEmbed ui="analytics/selections" app-id={appId} />;
};
