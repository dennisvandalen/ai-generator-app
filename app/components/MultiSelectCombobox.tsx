import {
  LegacyStack,
  Tag,
  Listbox,
  EmptySearchResult,
  Combobox,
  Text,
  AutoSelection,
} from '@shopify/polaris';
import {useState, useCallback, useMemo} from 'react';

interface MultiselectComboboxProps {
  selectedOptions: string[];
  onSelectionChange: (options: string[]) => void;
  suggestionOptions: string[];
  label?: string;
  placeholder?: string;
  emptyStateText?: string;
}

function MultiselectCombobox({
  selectedOptions,
  onSelectionChange,
  suggestionOptions,
  label = "Search options",
  placeholder = "Search options",
  emptyStateText = "options"
}: MultiselectComboboxProps) {
  const [value, setValue] = useState('');
  const [suggestion, setSuggestion] = useState('');

  const handleActiveOptionChange = useCallback(
    (activeOption: string) => {
      const activeOptionIsAction = activeOption === value;

      if (!activeOptionIsAction && !selectedOptions.includes(activeOption)) {
        setSuggestion(activeOption);
      } else {
        setSuggestion('');
      }
    },
    [value, selectedOptions],
  );
  
  const updateSelection = useCallback(
    (selected: string) => {
      const nextSelectedOptions = new Set([...selectedOptions]);

      if (nextSelectedOptions.has(selected)) {
        nextSelectedOptions.delete(selected);
      } else {
        nextSelectedOptions.add(selected);
      }
      onSelectionChange([...nextSelectedOptions]);
      setValue('');
      setSuggestion('');
    },
    [selectedOptions, onSelectionChange],
  );

  const removeOption = useCallback(
    (option: string) => () => {
      updateSelection(option);
    },
    [updateSelection],
  );

  const getAllOptions = useCallback(() => {
    return [...new Set([...suggestionOptions, ...selectedOptions].sort())];
  }, [suggestionOptions, selectedOptions]);

  const formatOptionText = useCallback(
    (option: string) => {
      const trimValue = value.trim().toLocaleLowerCase();
      const matchIndex = option.toLocaleLowerCase().indexOf(trimValue);

      if (!value || matchIndex === -1) return option;

      const start = option.slice(0, matchIndex);
      const highlight = option.slice(matchIndex, matchIndex + trimValue.length);
      const end = option.slice(matchIndex + trimValue.length, option.length);

      return (
        <p>
          {start}
          <Text fontWeight="bold" as="span">
            {highlight}
          </Text>
          {end}
        </p>
      );
    },
    [value],
  );

  const escapeSpecialRegExCharacters = useCallback(
    (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    [],
  );

  const options = useMemo(() => {
    let list;
    const allOptions = getAllOptions();
    const filterRegex = new RegExp(escapeSpecialRegExCharacters(value), 'i');

    if (value) {
      list = allOptions.filter((option) => option.match(filterRegex));
    } else {
      list = allOptions;
    }

    return [...list];
  }, [value, getAllOptions, escapeSpecialRegExCharacters]);

  const verticalContentMarkup =
    selectedOptions.length > 0 ? (
      <LegacyStack spacing="extraTight" alignment="center">
        {selectedOptions.map((option) => (
          <Tag key={`option-${option}`} onRemove={removeOption(option)}>
            {option}
          </Tag>
        ))}
      </LegacyStack>
    ) : null;

  const optionMarkup =
    options.length > 0
      ? options.map((option) => {
        return (
          <Listbox.Option
            key={option}
            value={option}
            selected={selectedOptions.includes(option)}
            accessibilityLabel={option}
          >
            <Listbox.TextOption selected={selectedOptions.includes(option)}>
              {formatOptionText(option)}
            </Listbox.TextOption>
          </Listbox.Option>
        );
      })
      : null;

  const noResults = value && !getAllOptions().includes(value);

  const actionMarkup = noResults ? (
    <Listbox.Action value={value}>{`Add "${value}"`}</Listbox.Action>
  ) : null;

  const emptyStateMarkup = optionMarkup ? null : (
    <EmptySearchResult
      title=""
      description={`No ${emptyStateText} found matching "${value}"`}
    />
  );

  const listboxMarkup =
    optionMarkup || actionMarkup || emptyStateMarkup ? (
      <Listbox
        autoSelection={AutoSelection.None}
        onSelect={updateSelection}
        onActiveOptionChange={handleActiveOptionChange}
      >
        {actionMarkup}
        {optionMarkup}
      </Listbox>
    ) : null;

  return (
    <div>
      <Text variant="bodyMd" as="label" fontWeight="medium">
        {label}
      </Text>
      <div style={{marginTop: '0.5rem'}}>
        <Combobox
          allowMultiple
          activator={
            <Combobox.TextField
              autoComplete="off"
              label={label}
              labelHidden
              value={value}
              suggestion={suggestion}
              placeholder={placeholder}
              verticalContent={verticalContentMarkup}
              onChange={setValue}
            />
          }
        >
          {listboxMarkup}
        </Combobox>
      </div>
    </div>
  );
}

export {MultiselectCombobox}
