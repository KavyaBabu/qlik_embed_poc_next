interface Window {
  qlikEmbed: {
    connect: () => {
      on: (event: string, callback: (data: any) => void) => void;
    };
  };
}