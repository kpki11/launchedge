// src/screens/AIChatScreen.tsx
// LaunchEdge AI Copilot - powered by Groq (llama-3.3-70b-versatile)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Animated,
  Linking, Modal, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Theme, Colors } from '../theme/colors';
import { Typography, Spacing, Radius } from '../theme/typography';
import { useBusinessStore } from '../store/useBusinessStore';
import { useTableStore } from '../store/useTableStore';
import { getTables, getTableFields, getRecords, createTable, addRecordsBatch, getDb } from '../services/database';
import { ParticleField, GlowOrb } from '../components/ParticleField';

const GROQ_API_KEY  = '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';
const GROQ_MODEL    = 'llama-3.3-70b-versatile';
const GROQ_URL      = 'https://api.groq.com/openai/v1/chat/completions';
const FORM_URL      = 'https://formspree.io/f/xaqzykgn';
const SUPPORT_EMAIL = 'launchedge26@gmail.com';
const SUPPORT_PHONE = '6367903133';

const QUICK_PROMPTS = [
  'Summarize my sales today',
  'Which items are low stock?',
  'Create a table from this data',
  'Show pending approvals',
  'How do I add a new table?',
];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  action?: TableAction;
}
interface TableAction {
  type: 'create_table';
  tableName: string;
  fields: { name: string; type: string }[];
  records: object[];
}

// ---------- Feedback Modal ----------
function FeedbackModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [name, setName]       = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);

  const handleSend = async () => {
    if (!message.trim()) { Alert.alert('Please enter a message'); return; }
    setSending(true);
    try {
      const res = await fetch(FORM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'Anonymous', message: message.trim() }),
      });
      if (res.ok) {
        setSent(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => { setSent(false); setName(''); setMessage(''); onClose(); }, 1800);
      } else {
        Alert.alert('Error', 'Could not send feedback. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Network error. Check your connection.');
    } finally { setSending(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={fb.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
          <View style={fb.sheet}>
            <View style={fb.handle} />
            <View style={fb.row}>
              <Text style={fb.title}>Send Feedback</Text>
              <TouchableOpacity onPress={onClose} style={fb.closeBtn}>
                <Ionicons name="close" size={20} color={Theme.textSecondary} />
              </TouchableOpacity>
            </View>
            {sent ? (
              <View style={fb.sentBox}>
                <Text style={fb.sentIcon}>✓</Text>
                <Text style={fb.sentTxt}>Thank you! Feedback sent.</Text>
              </View>
            ) : (
              <>
                <Text style={fb.label}>Your name (optional)</Text>
                <TextInput
                  style={fb.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Rahul"
                  placeholderTextColor={Theme.textDim}
                />
                <Text style={fb.label}>Message *</Text>
                <TextInput
                  style={[fb.input, fb.textArea]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Share a bug, suggestion or question..."
                  placeholderTextColor={Theme.textDim}
                  multiline
                  maxLength={1000}
                />
                <TouchableOpacity style={fb.sendBtn} onPress={handleSend} disabled={sending} activeOpacity={0.85}>
                  {sending
                    ? <ActivityIndicator color={Colors.ivory} size="small" />
                    : <Text style={fb.sendTxt}>Send Feedback</Text>}
                </TouchableOpacity>
                <View style={fb.altRow}>
                  <TouchableOpacity onPress={() => Linking.openURL('mailto:' + SUPPORT_EMAIL)} style={fb.altLink}>
                    <Ionicons name="mail-outline" size={13} color={Theme.textDim} />
                    <Text style={fb.altTxt}> Email us</Text>
                  </TouchableOpacity>
                  <Text style={fb.dot}> · </Text>
                  <TouchableOpacity onPress={() => Linking.openURL('tel:+91' + SUPPORT_PHONE)} style={fb.altLink}>
                    <Ionicons name="call-outline" size={13} color={Theme.textDim} />
                    <Text style={fb.altTxt}> Call us</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const fb = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(12,11,9,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet:    { width: '100%', backgroundColor: Theme.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 10 },
  handle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: Theme.border, alignSelf: 'center', marginBottom: 8 },
  row:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:    { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 20, color: Theme.textPrimary },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Theme.surface, justifyContent: 'center', alignItems: 'center' },
  label:    { fontFamily: 'DMSans_500Medium', fontSize: 13, color: Theme.textSecondary, marginTop: 4 },
  input:    { backgroundColor: Theme.surface, borderWidth: 1, borderColor: Theme.border, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, fontFamily: 'DMSans_400Regular', fontSize: 14, color: Theme.textPrimary },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  sendBtn:  { backgroundColor: Theme.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  sendTxt:  { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: Colors.ivory },
  altRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  altLink:  { flexDirection: 'row', alignItems: 'center' },
  altTxt:   { fontFamily: 'DMSans_400Regular', fontSize: 12, color: Theme.textDim },
  dot:      { fontFamily: 'DMSans_400Regular', fontSize: 12, color: Theme.textDim },
  sentBox:  { alignItems: 'center', paddingVertical: 32, gap: 10 },
  sentIcon: { fontSize: 40, color: Theme.success },
  sentTxt:  { fontFamily: 'DMSans_500Medium', fontSize: 16, color: Theme.textPrimary },
});

// ---------- ActionCard ----------
function ActionCard({ action, businessId, onDone }: {
  action: TableAction; businessId: string; onDone: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const tableId = 'tbl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      await createTable({ id: tableId, businessId, name: action.tableName, icon: 'grid-outline', category: 'custom', fields: [] });
      const db = await getDb();
      for (let i = 0; i < action.fields.length; i++) {
        const f   = action.fields[i];
        const fId = 'fld_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 5);
        await db.runAsync(
          'INSERT INTO table_fields (id, tableId, name, type, isRequired, defaultValue, sortOrder) VALUES (?,?,?,?,?,?,?)',
          [fId, tableId, f.name, f.type, 0, '', i]
        );
      }
      if (action.records.length > 0) await addRecordsBatch(tableId, action.records, 'ai_copilot');
      setDone(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone('Table "' + action.tableName + '" created with ' + action.fields.length + ' fields and ' + action.records.length + ' records! Go to Tables tab.');
    } catch (e: any) {
      Alert.alert('Error', 'Could not create table: ' + (e?.message || ''));
    } finally { setLoading(false); }
  };

  if (done) return null;
  return (
    <View style={aS.card}>
      <View style={aS.row}>
        <Ionicons name="sparkles" size={15} color={Colors.gold} />
        <Text style={aS.title}> Create: {action.tableName}</Text>
      </View>
      <Text style={aS.sub}>{action.fields.length} fields · {action.records.length} rows</Text>
      <View style={aS.chips}>
        {action.fields.slice(0, 5).map((f, i) => (
          <View key={i} style={aS.chip}><Text style={aS.chipTxt}>{f.name} ({f.type})</Text></View>
        ))}
        {action.fields.length > 5 && <View style={aS.chip}><Text style={aS.chipTxt}>+{action.fields.length - 5} more</Text></View>}
      </View>
      <TouchableOpacity style={aS.btn} onPress={handleCreate} disabled={loading} activeOpacity={0.8}>
        {loading ? <ActivityIndicator color={Colors.ivory} size="small" /> : <Text style={aS.btnTxt}>Build This Table</Text>}
      </TouchableOpacity>
    </View>
  );
}

const aS = StyleSheet.create({
  card:    { backgroundColor: Theme.surface, borderWidth: 1.5, borderColor: Colors.gold, borderRadius: 14, padding: 12, marginTop: 8, gap: 6 },
  row:     { flexDirection: 'row', alignItems: 'center' },
  title:   { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: Theme.textPrimary },
  sub:     { fontFamily: 'DMSans_400Regular', fontSize: 12, color: Theme.textSecondary },
  chips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip:    { backgroundColor: Theme.primaryLight, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  chipTxt: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: Theme.primary },
  btn:     { backgroundColor: Theme.primary, borderRadius: 10, paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  btnTxt:  { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: Colors.ivory },
});

// ---------- MsgBubble ----------
function MsgBubble({ msg, businessId, onActionDone, onFeedback }: {
  msg: Message; businessId: string; onActionDone: (t: string) => void; onFeedback: () => void;
}) {
  const isUser = msg.role === 'user';
  const fade   = useRef(new Animated.Value(0)).current;
  const slide  = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[s.row, isUser ? s.rowUser : s.rowAI, { opacity: fade, transform: [{ translateY: slide }] }]}>
      {!isUser && <View style={s.avatar}><Text style={s.avatarTxt}>✦</Text></View>}
      <View style={{ maxWidth: '85%' }}>
        <View style={[s.bubble, isUser ? s.bubUser : s.bubAI]}>
          <Text style={[s.bubTxt, isUser ? s.bubTxtUser : s.bubTxtAI]}>{msg.content}</Text>
          <Text style={[s.time, isUser ? s.timeUser : s.timeAI]}>{formatTime(msg.timestamp)}</Text>
        </View>
        {msg.action && <ActionCard action={msg.action} businessId={businessId} onDone={onActionDone} />}
      </View>
    </Animated.View>
  );
}

// ---------- Main Screen ----------
export default function AIChatScreen({ onClose }: { onClose?: () => void }) {
  const { activeBusiness }  = useBusinessStore();
  const [messages, setMessages] = useState<Message[]>([{
    id: 'w', role: 'assistant', timestamp: Date.now(),
    content: 'Hi! I am your LaunchEdge AI Copilot\n\nI can:\n- Analyse your business data\n- Answer questions about your tables\n- Create tables from data you paste\n- Guide you on using the app\n\nTip: Paste any CSV or list and say "make a table from this"!',
  }]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [ctx, setCtx]                 = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const buildCtx = useCallback(async () => {
    if (!activeBusiness?.id) return '';
    try {
      const allTables = await getTables(activeBusiness.id);
      const parts = ['Business: ' + activeBusiness.name, 'Tables: ' + allTables.map((t: any) => t.name).join(', ')];
      for (const t of allTables.slice(0, 4)) {
        const fields = await getTableFields(t.id);
        const recs   = await getRecords(t.id);
        parts.push('Table "' + t.name + '" (' + recs.length + ' records). Fields: ' + fields.map((f: any) => f.name + '(' + f.type + ')').join(', '));
        const sample = recs.slice(-4).map((r: any) => { try { return JSON.stringify(typeof r.data === 'string' ? JSON.parse(r.data) : r.data); } catch { return ''; } });
        if (sample.length) parts.push('Recent: ' + sample.join(' | '));
      }
      return parts.join('\n');
    } catch { return 'Business: ' + (activeBusiness?.name || ''); }
  }, [activeBusiness]);

  useEffect(() => { buildCtx().then(setCtx); }, [buildCtx]);

  const addMsg = (m: Message) => setMessages(p => [...p, m]);

  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');
    addMsg({ id: Date.now().toString(), role: 'user', content, timestamp: Date.now() });
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

    const sysPrompt = 'You are LaunchEdge AI Copilot for Indian SME ERP app.\nYou can answer questions AND create tables.\nBUSINESS DATA:\n' + (ctx || 'No data yet.') + '\n\nTo CREATE A TABLE, respond with explanation then this JSON block:\n```json\n{"action":"create_table","tableName":"Name","fields":[{"name":"Col","type":"text"}],"records":[{"Col":"val"}]}\n```\nField types: text, number, date, boolean, select. Be concise.';

    try {
      const apiMsgs = [
        { role: 'system', content: sysPrompt },
        ...messages.filter(m => m.role !== 'system').slice(-10).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content },
      ];
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + GROQ_API_KEY },
        body: JSON.stringify({ model: GROQ_MODEL, messages: apiMsgs, max_tokens: 800, temperature: 0.6 }),
      });
      if (!res.ok) throw new Error('API error ' + res.status);
      const data = await res.json();
      let reply: string = data?.choices?.[0]?.message?.content?.trim() || 'No response.';
      let action: TableAction | undefined;
      const m = reply.match(/```json\s*([\s\S]*?)```/);
      if (m) {
        try {
          const p = JSON.parse(m[1].trim());
          if (p.action === 'create_table') {
            action = { type: 'create_table', tableName: p.tableName, fields: p.fields, records: p.records || [] };
            reply = reply.replace(/```json[\s\S]*?```/, '').trim();
          }
        } catch {}
      }
      addMsg({ id: (Date.now() + 1).toString(), role: 'assistant', content: reply, timestamp: Date.now(), action });
    } catch (e: any) {
      addMsg({ id: (Date.now() + 1).toString(), role: 'assistant', content: 'Error: ' + (e?.message || 'Check internet.'), timestamp: Date.now() });
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    }
  }, [input, loading, messages, ctx]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ParticleField variant="full" height={900} count={10} />
        <GlowOrb x={-30} y={80} size={200} color="rgba(196,150,58,0.09)" />
      </View>

      <View style={s.header}>
        <View style={s.hLeft}>
          <View style={s.hIcon}><Text style={s.hIconTxt}>✦</Text></View>
          <View>
            <Text style={s.hTitle}>AI Copilot</Text>
            <Text style={s.hSub}>Groq · Can create tables from data</Text>
          </View>
        </View>
        <View style={s.hRight}>
          <TouchableOpacity style={s.hBtn} onPress={() => setShowFeedback(true)}>
            <Ionicons name="chatbubble-ellipses-outline" size={19} color={Theme.primary} />
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity style={s.hBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={Theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={s.list} contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {messages.map(msg => (
            <MsgBubble key={msg.id} msg={msg} businessId={activeBusiness?.id || ''}
              onActionDone={(t) => addMsg({ id: Date.now().toString(), role: 'assistant', content: t, timestamp: Date.now() })}
              onFeedback={() => setShowFeedback(true)} />
          ))}
          {loading && (
            <View style={s.loadRow}>
              <View style={s.avatar}><Text style={s.avatarTxt}>✦</Text></View>
              <View style={s.loadBub}>
                <ActivityIndicator color={Theme.primary} size="small" />
                <Text style={s.loadTxt}>Thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.qRow}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {QUICK_PROMPTS.map(p => (
            <TouchableOpacity key={p} style={s.qChip} onPress={() => send(p)} activeOpacity={0.75}>
              <Text style={s.qChipTxt}>{p}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[s.qChip, { borderColor: Colors.gold, backgroundColor: 'rgba(196,150,58,0.08)' }]}
            onPress={() => setShowFeedback(true)} activeOpacity={0.75}>
            <Text style={[s.qChipTxt, { color: Colors.gold }]}>Feedback</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={s.inputBar}>
          <TextInput style={s.input} value={input} onChangeText={setInput}
            placeholder="Ask anything or paste data to create a table..."
            placeholderTextColor={Theme.textDim} multiline maxLength={3000} />
          <TouchableOpacity style={[s.sendBtn, (!input.trim() || loading) && s.sendDis]}
            onPress={() => send()} activeOpacity={0.8} disabled={!input.trim() || loading}>
            <Ionicons name="send" size={18} color={Colors.ivory} />
          </TouchableOpacity>
        </View>

        <View style={s.supBar}>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:' + SUPPORT_EMAIL)} style={s.supLink}>
            <Ionicons name="mail-outline" size={13} color={Theme.textDim} />
            <Text style={s.supTxt}> Email</Text>
          </TouchableOpacity>
          <Text style={s.dot}> · </Text>
          <TouchableOpacity onPress={() => Linking.openURL('tel:+91' + SUPPORT_PHONE)} style={s.supLink}>
            <Ionicons name="call-outline" size={13} color={Theme.textDim} />
            <Text style={s.supTxt}> Call</Text>
          </TouchableOpacity>
          <Text style={s.dot}> · </Text>
          <TouchableOpacity onPress={() => setShowFeedback(true)} style={s.supLink}>
            <Ionicons name="document-text-outline" size={13} color={Theme.textDim} />
            <Text style={s.supTxt}> Feedback</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <FeedbackModal visible={showFeedback} onClose={() => setShowFeedback(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Theme.background },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Theme.border, backgroundColor: Theme.background },
  hLeft:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hIcon:       { width: 36, height: 36, borderRadius: 18, backgroundColor: Theme.primaryLight, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Theme.border },
  hIconTxt:    { fontSize: 16, color: Theme.primary },
  hTitle:      { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 18, color: Theme.textPrimary },
  hSub:        { fontFamily: 'DMSans_400Regular', fontSize: 11, color: Theme.textDim },
  hRight:      { flexDirection: 'row', gap: 8 },
  hBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: Theme.primaryLight, justifyContent: 'center', alignItems: 'center' },
  list:        { flex: 1 },
  listContent: { padding: 14, paddingBottom: 20, gap: 12 },
  row:         { flexDirection: 'row', alignItems: 'flex-end', maxWidth: '88%' },
  rowUser:     { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  rowAI:       { alignSelf: 'flex-start', gap: 6 },
  avatar:      { width: 28, height: 28, borderRadius: 14, backgroundColor: Theme.primaryLight, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Theme.border, marginBottom: 4 },
  avatarTxt:   { fontSize: 12, color: Theme.primary },
  bubble:      { borderRadius: 14, paddingHorizontal: 13, paddingVertical: 9, maxWidth: '100%' },
  bubUser:     { backgroundColor: Theme.primary, borderBottomRightRadius: 4 },
  bubAI:       { backgroundColor: Theme.surface, borderWidth: 1, borderColor: Theme.border, borderBottomLeftRadius: 4 },
  bubTxt:      { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20 },
  bubTxtUser:  { color: Colors.ivory },
  bubTxtAI:    { color: Theme.textPrimary },
  time:        { fontFamily: 'DMSans_400Regular', fontSize: 10, marginTop: 3 },
  timeUser:    { color: 'rgba(250,248,243,0.6)', textAlign: 'right' },
  timeAI:      { color: Theme.textDim },
  loadRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  loadBub:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Theme.surface, borderWidth: 1, borderColor: Theme.border, borderRadius: 14, borderBottomLeftRadius: 4, paddingHorizontal: 13, paddingVertical: 9 },
  loadTxt:     { fontFamily: 'DMSans_400Regular', fontSize: 13, color: Theme.textDim },
  qRow:        { maxHeight: 44, marginVertical: 4 },
  qChip:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 6, borderRadius: 999, backgroundColor: Theme.surface, borderWidth: 1, borderColor: Theme.border },
  qChipTxt:    { fontFamily: 'DMSans_400Regular', fontSize: 12, color: Theme.textSecondary },
  inputBar:    { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 8, gap: 8, borderTopWidth: 1, borderTopColor: Theme.border, backgroundColor: Theme.background },
  input:       { flex: 1, minHeight: 40, maxHeight: 110, fontFamily: 'DMSans_400Regular', fontSize: 14, color: Theme.textPrimary, backgroundColor: Theme.surface, borderWidth: 1, borderColor: Theme.border, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 9, textAlignVertical: 'top' },
  sendBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: Theme.primary, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.gold, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 4 },
  sendDis:     { backgroundColor: Theme.border, shadowOpacity: 0, elevation: 0 },
  supBar:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, paddingVertical: 6, backgroundColor: Theme.background },
  supLink:     { flexDirection: 'row', alignItems: 'center' },
  supTxt:      { fontFamily: 'DMSans_400Regular', fontSize: 11, color: Theme.textDim },
  dot:         { fontFamily: 'DMSans_400Regular', fontSize: 11, color: Theme.textDim },
});
