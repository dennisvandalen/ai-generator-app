import { useState, useId } from 'react';
import {
  BlockStack,
  Card,
  Text,
  InlineStack,
  ButtonGroup,
  Button,
  ProgressBar,
  Box,
  Collapsible,
  Tooltip,
  Spinner,
  Icon,
  Popover,
  ActionList,
  Image
} from '@shopify/polaris';
import { MenuHorizontalIcon, ChevronDownIcon, ChevronUpIcon, CheckIcon, XIcon } from "@shopify/polaris-icons";
import styles from './SetupGuide.module.css';

// Interface for button props
interface ButtonProps {
  url?: string;
  external?: string;
  onAction?: () => void;
  // Removed [key: string]: any to avoid using 'any' type
}

// Interface for button configuration
interface ButtonConfig {
  content: string;
  props: ButtonProps;
}

// Interface for image properties
interface ItemImage {
  url: string;
  alt?: string;
}

// Interface for setup guide item
interface SetupItem {
  id: number;
  title: string;
  description: string;
  image?: ItemImage;
  complete: boolean;
  primaryButton?: ButtonConfig;
  secondaryButton?: ButtonConfig;
}

// Props for the SetupGuide component
interface SetupGuideProps {
  onDismiss: () => void;
  onStepComplete: (id: number) => Promise<void>;
  items: SetupItem[];
}

// Props for the SetupItem component
interface SetupItemProps extends SetupItem {
  expanded: boolean;
  setExpanded: () => void;
  onComplete: (id: number) => Promise<void>;
}

export const SetupGuide = ({ onDismiss, onStepComplete, items }: SetupGuideProps): JSX.Element => {
  const [expanded, setExpanded] = useState<number>(items.findIndex((item) => !item.complete));
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(true);
  const [popoverActive, setPopoverActive] = useState<boolean>(false);
  const accessId = useId();
  const completedItemsLength = items.filter((item) => item.complete).length;

  return (
    <Card padding='0'>
      <Box padding='400' paddingBlockEnd='400'>
        <BlockStack>
          <InlineStack align='space-between' blockAlign='center'>
            <Text as='h3' variant='headingMd'>
              Setup Guide
            </Text>
            <ButtonGroup gap='tight' noWrap>
              <Popover
                active={popoverActive}
                onClose={() => setPopoverActive((prev) => !prev)}
                activator={
                  <Button
                    onClick={() => setPopoverActive((prev) => !prev)}
                    variant='tertiary'
                    icon={MenuHorizontalIcon}
                  />
                }
              >
                <ActionList
                  actionRole='menuitem'
                  items={[
                    {
                      content: 'Dismiss',
                      onAction: onDismiss,
                      prefix: (
                        <div
                          style={{
                            height: '1rem',
                            width: '1rem',
                            paddingTop: '.05rem'
                          }}
                        >
                          <Icon tone='subdued' source={XIcon} />
                        </div>
                      )
                    }
                  ]}
                />
              </Popover>

              <Button
                variant='tertiary'
                icon={isGuideOpen ? ChevronUpIcon : ChevronDownIcon}
                onClick={() => {
                  setIsGuideOpen((prev) => {
                    if (!prev) setExpanded(items.findIndex((item) => !item.complete));
                    return !prev;
                  });
                }}
                ariaControls={accessId}
              />
            </ButtonGroup>
          </InlineStack>
          <Text as='p' variant='bodyMd'>
            Use this personalized guide to get your app up and running.
          </Text>
          <div style={{ marginTop: '.8rem' }}>
            <InlineStack blockAlign='center' gap='200'>
              {completedItemsLength === items.length ? (
                <div style={{ maxHeight: '1rem' }}>
                  <InlineStack wrap={false} gap='100'>
                    <Icon
                      source={CheckIcon}
                      tone='subdued'
                      accessibilityLabel='Check icon to indicate completion of Setup Guide'
                    />
                    <Text as='p' variant='bodySm' tone='subdued'>
                      Done
                    </Text>
                  </InlineStack>
                </div>
              ) : (
                <Text as='span' variant='bodySm'>
                  {`${completedItemsLength} / ${items.length} completed`}
                </Text>
              )}

              {completedItemsLength !== items.length ? (
                <div style={{ width: '100px' }}>
                  <ProgressBar
                    progress={(items.filter((item) => item.complete).length / items.length) * 100}
                    size='small'
                    tone='primary'
                    animated
                  />
                </div>
              ) : null}
            </InlineStack>
          </div>
        </BlockStack>
      </Box>
      <Collapsible open={isGuideOpen} id={accessId}>
        <Box padding='200'>
          <BlockStack gap='100'>
            {items.map((item) => {
              return (
                <SetupItem
                  key={item.id}
                  expanded={expanded === item.id}
                  setExpanded={() => setExpanded(item.id)}
                  onComplete={onStepComplete}
                  {...item}
                />
              );
            })}
          </BlockStack>
        </Box>
      </Collapsible>
      {completedItemsLength === items.length ? (
        <Box
          background='bg-surface-secondary'
          borderBlockStartWidth='025'
          borderColor='border-secondary'
          padding='300'
        >
          <InlineStack align='end'>
            <Button onClick={onDismiss}>Dismiss Guide</Button>
          </InlineStack>
        </Box>
      ) : null}
    </Card>
  );
};

const SetupItem = ({
                     complete,
                     onComplete,
                     expanded,
                     setExpanded,
                     title,
                     description,
                     image,
                     primaryButton,
                     secondaryButton,
                     id
                   }: SetupItemProps): JSX.Element => {
  const [loading, setLoading] = useState<boolean>(false);

  const completeItem = async (): Promise<void> => {
    setLoading(true);
    await onComplete(id);
    setLoading(false);
  };

  return (
    <Box borderRadius='200' background={expanded ? 'bg-surface-active' : undefined}>
      <div className={`${styles.setupItem} ${expanded ? styles.setupItemExpanded : ""}`}>
        <InlineStack gap='200' align='start' blockAlign='start' wrap={false}>
          <Tooltip content={complete ? 'Mark as not done' : 'Mark as done'} activatorWrapper='div'>
            <Button
              onClick={completeItem}
              variant='monochromePlain'
              icon={
                loading ? (
                  <Spinner size='small' />
                ) : complete ? (
                  <CheckIcon
                    style={{
                      width: '1.25rem',
                      height: '1.25rem',
                      borderRadius: '100%',
                      background: '#303030',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      fill: 'white'
                    }}
                  />
                ) : (
                  outlineSvg
                )
              }
            />
          </Tooltip>
          <div
            className={styles.itemContent}
            onClick={expanded ? () => null : setExpanded}
            style={{
              cursor: expanded ? 'default' : 'pointer',
              paddingTop: '.15rem',
              width: '100%'
            }}
          >
            <BlockStack gap='300' id={id.toString()}>
              <Text as='h4' variant={expanded ? 'headingSm' : 'bodyMd'}>
                {title}
              </Text>
              <Collapsible open={expanded} id={id.toString()}>
                <Box paddingBlockEnd='150' paddingInlineEnd='150'>
                  <BlockStack gap='400'>
                    <Text as='p' variant='bodyMd'>
                      {description}
                    </Text>
                    {primaryButton || secondaryButton ? (
                      <ButtonGroup gap='loose'>
                        {primaryButton ? (
                          <Button variant='primary' {...primaryButton.props}>
                            {primaryButton.content}
                          </Button>
                        ) : null}
                        {secondaryButton ? (
                          <Button variant='tertiary' {...secondaryButton.props}>
                            {secondaryButton.content}
                          </Button>
                        ) : null}
                      </ButtonGroup>
                    ) : null}
                  </BlockStack>
                </Box>
              </Collapsible>
            </BlockStack>
            {image && expanded ? ( // hide image at 700px down
              <Image
                className={styles.itemImage}
                source={image.url}
                alt={image.alt ?? 'Setup guide'}
                style={{ maxHeight: '7.75rem' }}
              />
            ) : null}
          </div>
        </InlineStack>
      </div>
    </Box>
  );
};

const outlineSvg: React.ReactElement = (
  <svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <path
      fillRule='evenodd'
      clipRule='evenodd'
      d='M21.9147 13.3062L19.9535 15.2674C19.8589 15.362 19.7451 15.4371 19.6189 15.4878C19.4926 15.5384 19.3569 15.5637 19.2198 15.5621C19.0827 15.5605 18.9477 15.5321 18.8227 15.4786C18.6977 15.4251 18.5857 15.3475 18.4934 15.2508C18.401 15.1542 18.3286 15.0387 18.2808 14.9112C18.233 14.7837 18.2108 14.6471 18.2155 14.5101C18.2202 14.373 18.2517 14.2386 18.3081 14.1149C18.3644 13.9913 18.4445 13.8812 18.5435 13.7908L19.5047 12.8296C19.6953 12.639 19.6953 12.3307 19.5047 12.1401L11.8599 4.49526C11.6693 4.30467 11.361 4.30467 11.1704 4.49526L3.52552 12.1401C3.33493 12.3307 3.33493 12.639 3.52552 12.8296L11.1704 20.4744C11.361 20.665 11.6693 20.665 11.8599 20.4744L14.7908 17.5435C14.8812 17.4445 14.9913 17.3644 15.1149 17.3081C15.2386 17.2517 15.373 17.2202 15.5101 17.2155C15.6471 17.2108 15.7837 17.233 15.9112 17.2808C16.0387 17.3286 16.1542 17.401 16.2508 17.4934C16.3475 17.5857 16.4251 17.6977 16.4786 17.8227C16.5321 17.9477 16.5605 18.0827 16.5621 18.2198C16.5637 18.3569 16.5384 18.4926 16.4878 18.6189C16.4371 18.7451 16.362 18.8589 16.2674 18.9535L13.3365 21.8844C12.3742 22.8467 10.6561 22.8467 9.69375 21.8844L2.04891 14.2395C1.08657 13.2772 1.08657 11.5591 2.04891 10.5967L9.69375 2.95186C10.6561 1.98952 12.3742 1.98952 13.3365 2.95186L20.9814 10.5967C21.9437 11.5591 21.9437 13.2772 20.9814 14.2395L20.9147 13.3062Z'
      fill='#8C9196'
      style={{ display: 'none' }}
    ></path>
    <path
      fillRule='evenodd'
      clipRule='evenodd'
      d='M10.5334 2.10692C11.0844 1.55594 11.8293 1.25 12.6001 1.25C13.3708 1.25 14.1158 1.55594 14.6667 2.10692L22.3116 9.75177C22.8626 10.3027 23.1685 11.0477 23.1685 11.8184C23.1685 12.5891 22.8626 13.3341 22.3116 13.885L14.6667 21.5299C14.1158 22.0809 13.3708 22.3868 12.6001 22.3868C11.8293 22.3868 11.0844 22.0809 10.5334 21.5299L2.88857 13.885C2.33759 13.3341 2.03165 12.5891 2.03165 11.8184C2.03165 11.0477 2.33759 10.3027 2.88857 9.75177L10.5334 2.10692ZM12.6001 2.75C12.1561 2.75 11.7301 2.92709 11.4167 3.24223L3.77188 10.8871C3.45674 11.2022 3.27965 11.6283 3.27965 12.0723C3.27965 12.5163 3.45674 12.9423 3.77188 13.2574L11.4167 20.9023C11.7319 21.2174 12.1579 21.3945 12.6019 21.3945C13.0459 21.3945 13.4719 21.2174 13.7871 20.9023L21.4319 13.2574C21.7471 12.9423 21.9242 12.5163 21.9242 12.0723C21.9242 11.6283 21.7471 11.2022 21.4319 10.8871L13.7871 3.24223C13.4719 2.92709 13.0459 2.75 12.6019 2.75H12.6001Z'
      fill='#8A8A8A'
    ></path>
    <circle cx='12' cy='12' r='12' fill='#DBDDDF' style={{ display: 'none' }}></circle>
    <circle
      cx='12'
      cy='12'
      r='9'
      fill='#F6F6F7'
      stroke='#999EA4'
      strokeWidth='2'
      style={{ display: 'none' }}
    ></circle>
  </svg>
);
