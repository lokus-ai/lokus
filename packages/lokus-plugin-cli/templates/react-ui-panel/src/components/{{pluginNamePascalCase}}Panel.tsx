import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { use{{pluginNamePascalCase}}Context } from '../contexts/{{pluginNamePascalCase}}Context';
import { Button } from './Button';
import { StatusIndicator } from './StatusIndicator';
import { DataList } from './DataList';

const PanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--lokus-background);
  color: var(--lokus-foreground);
  font-family: var(--lokus-font-family);
  font-size: var(--lokus-font-size);
  padding: 16px;
  box-sizing: border-box;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--lokus-border);
`;

const Title = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--lokus-foreground);
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const Section = styled.div`
  margin-bottom: 20px;
`;

const SectionTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--lokus-secondary-foreground);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
`;

const InfoCard = styled.div`
  background: var(--lokus-secondary-background);
  border: 1px solid var(--lokus-border);
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 12px;
`;

const InfoLabel = styled.div`
  font-size: 12px;
  color: var(--lokus-secondary-foreground);
  margin-bottom: 4px;
`;

const InfoValue = styled.div`
  font-size: 14px;
  color: var(--lokus-foreground);
  font-weight: 500;
`;

export const {{pluginNamePascalCase}}Panel: React.FC = () => {
  const { context, state, actions } = use{{pluginNamePascalCase}}Context();
  const [data, setData] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize panel data
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Simulate data loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      setData([
        'Item 1: Sample data',
        'Item 2: More data',
        'Item 3: Additional information',
        'Item 4: Plugin data'
      ]);
      context.logger.debug('Data loaded successfully');
    } catch (error) {
      context.logger.error('Failed to load data:', error as Error);
      context.ui.showMessage('Failed to load data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    actions.refresh();
    loadData();
  };

  const handleClear = () => {
    setData([]);
    actions.clear();
    context.ui.showMessage('Data cleared', 'info');
  };

  const handleExport = () => {
    const exportData = {
      pluginName: '{{pluginName}}',
      timestamp: new Date().toISOString(),
      data: data,
      state: state
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `{{pluginName}}-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    context.ui.showMessage('Data exported successfully', 'success');
  };

  const handleSettings = () => {
    context.ui.showMessage('Settings panel would open here', 'info');
  };

  return (
    <PanelContainer>
      <Header>
        <Title>{{pluginNamePascalCase}}</Title>
        <StatusIndicator 
          status={state.isActive ? 'active' : 'inactive'}
          tooltip={`Plugin is ${state.isActive ? 'active' : 'inactive'}`}
        />
      </Header>

      <Content>
        <Section>
          <SectionTitle>Actions</SectionTitle>
          <ButtonGroup>
            <Button 
              variant="primary" 
              onClick={handleRefresh}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
            <Button 
              variant="secondary" 
              onClick={handleClear}
            >
              Clear
            </Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button 
              variant="outline" 
              onClick={handleExport}
              disabled={data.length === 0}
            >
              Export
            </Button>
            <Button 
              variant="outline" 
              onClick={handleSettings}
            >
              Settings
            </Button>
          </ButtonGroup>
        </Section>

        <Section>
          <SectionTitle>Information</SectionTitle>
          <InfoCard>
            <InfoLabel>Plugin Status</InfoLabel>
            <InfoValue>{state.isActive ? 'Active' : 'Inactive'}</InfoValue>
          </InfoCard>
          <InfoCard>
            <InfoLabel>Last Updated</InfoLabel>
            <InfoValue>{state.lastUpdate.toLocaleString()}</InfoValue>
          </InfoCard>
          <InfoCard>
            <InfoLabel>Data Count</InfoLabel>
            <InfoValue>{data.length} items</InfoValue>
          </InfoCard>
        </Section>

        <Section>
          <SectionTitle>Data</SectionTitle>
          <DataList 
            items={data}
            isLoading={isLoading}
            emptyMessage="No data available. Click Refresh to load data."
          />
        </Section>
      </Content>
    </PanelContainer>
  );
};