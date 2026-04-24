import { useState } from 'react'
import {
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Ionicons } from '@expo/vector-icons'
import { YStack, XStack, Text, useTheme } from 'tamagui'
import { translateApi } from '@/libs/api'
import { Card, AppButton, Badge, BadgeText } from '@/components/ui'

const LANGUAGES = [
  { code: 'auto', label: '自动检测' },
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'ru', label: 'Русский' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'ar', label: 'العربية' },
]

export default function TranslateScreen() {
  const theme = useTheme()
  const [sourceText, setSourceText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('en')
  const [enhance, setEnhance] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [detectedLang, setDetectedLang] = useState<string | null>(null)
  const [showSourcePicker, setShowSourcePicker] = useState(false)
  const [showTargetPicker, setShowTargetPicker] = useState(false)

  const getLangLabel = (code: string) =>
    LANGUAGES.find((l) => l.code === code)?.label || code

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      Alert.alert('提示', '请输入要翻译的文本')
      return
    }
    setTranslating(true)
    setDetectedLang(null)
    try {
      const result = await translateApi.translate({
        text: sourceText.trim(),
        source_lang: sourceLang === 'auto' ? undefined : sourceLang,
        target_lang: targetLang,
        enhance,
      })
      setTranslatedText(result.translation)
      if (result.detected_language) {
        setDetectedLang(result.detected_language)
      }
    } catch (e: any) {
      Alert.alert('翻译失败', e.message)
    } finally {
      setTranslating(false)
    }
  }

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto') return
    const tmp = sourceLang
    setSourceLang(targetLang)
    setTargetLang(tmp)
    setSourceText(translatedText)
    setTranslatedText(sourceText)
  }

  const handleCopy = async () => {
    if (!translatedText) return
    try {
      await Clipboard.setStringAsync(translatedText)
      Alert.alert('已复制', '翻译结果已复制到剪贴板')
    } catch {
      Alert.alert('复制失败')
    }
  }

  const renderLangPicker = (
    languages: typeof LANGUAGES,
    selected: string,
    onSelect: (code: string) => void,
    onClose: () => void,
  ) => (
    <Card marginBottom="$3">
      <XStack flexWrap="wrap" gap="$2">
        {languages.map((lang) => (
          <XStack
            key={lang.code}
            paddingHorizontal="$3"
            paddingVertical="$1.5"
            borderRadius="$7"
            backgroundColor={selected === lang.code ? '$primary' : '$backgroundHover'}
            pressStyle={{ opacity: 0.7 }}
            onPress={() => {
              onSelect(lang.code)
              onClose()
            }}
          >
            <Text
              fontSize={13}
              color={selected === lang.code ? '#fff' : '$colorSecondary'}
              fontWeight={selected === lang.code ? '500' : '400'}
            >
              {lang.label}
            </Text>
          </XStack>
        ))}
      </XStack>
    </Card>
  )

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background.val }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Language selector row */}
        <Card marginBottom="$4">
          <XStack alignItems="center" justifyContent="center" gap="$3">
            <XStack
              flex={1}
              justifyContent="center"
              alignItems="center"
              gap="$1"
              paddingVertical="$2"
              borderRadius="$4"
              backgroundColor="$backgroundHover"
              pressStyle={{ opacity: 0.7 }}
              onPress={() => setShowSourcePicker(!showSourcePicker)}
            >
              <Text fontSize={14} fontWeight="500" color="$color">
                {getLangLabel(sourceLang)}
              </Text>
              <Ionicons name="chevron-down" size={14} color={theme.colorSecondary.val} />
            </XStack>

            <XStack
              padding="$2"
              pressStyle={{ opacity: 0.7 }}
              onPress={handleSwapLanguages}
              opacity={sourceLang === 'auto' ? 0.3 : 1}
            >
              <Ionicons name="swap-horizontal" size={20} color={theme.primary.val} />
            </XStack>

            <XStack
              flex={1}
              justifyContent="center"
              alignItems="center"
              gap="$1"
              paddingVertical="$2"
              borderRadius="$4"
              backgroundColor="$backgroundHover"
              pressStyle={{ opacity: 0.7 }}
              onPress={() => setShowTargetPicker(!showTargetPicker)}
            >
              <Text fontSize={14} fontWeight="500" color="$color">
                {getLangLabel(targetLang)}
              </Text>
              <Ionicons name="chevron-down" size={14} color={theme.colorSecondary.val} />
            </XStack>
          </XStack>
        </Card>

        {showSourcePicker &&
          renderLangPicker(LANGUAGES, sourceLang, setSourceLang, () => setShowSourcePicker(false))}
        {showTargetPicker &&
          renderLangPicker(
            LANGUAGES.filter((l) => l.code !== 'auto'),
            targetLang,
            setTargetLang,
            () => setShowTargetPicker(false),
          )}

        {/* Source text input */}
        <Card marginBottom="$3" padding="$3.5" minHeight={120}>
          <TextInput
            style={{ fontSize: 16, color: theme.color.val, minHeight: 80 }}
            placeholder="输入要翻译的文本..."
            placeholderTextColor={theme.colorPlaceholder.val}
            value={sourceText}
            onChangeText={setSourceText}
            multiline
            textAlignVertical="top"
          />
          {sourceText.length > 0 && (
            <YStack position="absolute" top="$3" right="$3" pressStyle={{ opacity: 0.7 }} onPress={() => setSourceText('')}>
              <Ionicons name="close-circle" size={18} color={theme.colorPlaceholder.val} />
            </YStack>
          )}
        </Card>

        {/* AI enhance toggle + translate button */}
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
          <XStack
            alignItems="center"
            gap="$1"
            padding="$2"
            pressStyle={{ opacity: 0.7 }}
            onPress={() => setEnhance(!enhance)}
          >
            <Ionicons
              name={enhance ? 'sparkles' : 'sparkles-outline'}
              size={16}
              color={enhance ? theme.primary.val : theme.colorTertiary.val}
            />
            <Text fontSize={13} color={enhance ? '$primary' : '$colorTertiary'}>
              AI 增强
            </Text>
          </XStack>

          <AppButton
            pill
            disabled={translating}
            onPress={handleTranslate}
            icon={translating ? undefined : <Ionicons name="language-outline" size={18} color="#fff" />}
          >
            {translating ? <ActivityIndicator color="#fff" size="small" /> : '翻译'}
          </AppButton>
        </XStack>

        {/* Result */}
        {translatedText ? (
          <Card borderLeftWidth={3} borderLeftColor="$primary">
            {detectedLang && (
              <Badge variant="primary" alignSelf="flex-start" marginBottom="$2">
                <BadgeText variant="primary">检测到: {getLangLabel(detectedLang)}</BadgeText>
              </Badge>
            )}
            <Text fontSize={16} color="$color" lineHeight={24} selectable>
              {translatedText}
            </Text>
            <XStack
              alignSelf="flex-end"
              alignItems="center"
              gap="$1"
              marginTop="$3"
              padding="$1.5"
              pressStyle={{ opacity: 0.7 }}
              onPress={handleCopy}
            >
              <Ionicons name="copy-outline" size={16} color={theme.primary.val} />
              <Text fontSize={13} color="$primary">
                复制
              </Text>
            </XStack>
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
