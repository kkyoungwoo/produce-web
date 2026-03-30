'use client';

import React from 'react';
import ResultTable from '../ResultTable';

const SceneStudioResultPanel: React.FC<React.ComponentProps<typeof ResultTable>> = (props) => {
  return <ResultTable {...props} />;
};

export default SceneStudioResultPanel;
