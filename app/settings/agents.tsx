/**
 * AI agent access — DESIGN REFERENCE ONLY (see `@/features/agents/store`).
 *
 * Shows how a person would let an AI app they already use (through MCP) read and change
 * Fallback, and how the app keeps control: off by default, a permission per kind of action,
 * "ask me every time" as the default for anything that changes data, an approval sheet for each
 * request, and a list of things an agent can never do.
 */
import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Bot, Footprints, Info, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useToastStore } from '@/app-shell';
import { AGENT_PERMISSION_LABEL, AGENT_SCOPES, useAgentAccessStore, type AgentPermission } from '@/features/agents/store';
import { ACCENTS, FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { Button, ButtonPair, Card, Dialog, ListGroup, ListRow, Screen, SectionHeading, Select, Switch, TaskIcon } from '@/ui';
import { Text } from '@/ui/AppText';

const NEVER = ['Erase all your data', 'Change these permissions', 'Buy, change or cancel a subscription', 'See your account, sign-in or API key'];

export default function AgentAccess() {
  const t = useTheme();
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);
  const { enabled, permissions, agents, setEnabled, setPermission, connectExample, disconnect, disconnectAll } = useAgentAccessStore();
  const [pairing, setPairing] = useState(false);
  const [request, setRequest] = useState(false);

  return (
    <Screen title="AI agent access" onBack={() => router.push('/settings' as Href)}>
      <Card accessibilityLabel="Design preview. Agents cannot connect yet.">
        <View style={styles.noteRow}>
          <Info size={20} color={t.color.textMuted} />
          <Text style={[styles.note, { color: t.color.textMuted }]}>Design preview. Agents cannot connect yet. This screen shows how the permissions would work.</Text>
        </View>
      </Card>

      <Text style={[styles.intro, { color: t.color.text }]}>
        Let an AI app you already use, such as Claude or ChatGPT, look at your tasks and help with them. Nothing is shared until you turn this on, and an agent can only do what you allow here.
      </Text>

      <ListGroup>
        <ListRow
          label="Let AI agents connect"
          sublabel={enabled ? 'On. You approve what they do below.' : 'Off. No agent can see or change anything.'}
          right={<Switch value={enabled} onValueChange={setEnabled} accessibilityLabel="Let AI agents connect" />}
        />
      </ListGroup>

      {enabled ? (
        <>
          <ListGroup title="Connected" footer="An agent connects with a one-time code from this screen. You can disconnect it at any time.">
            {agents.length === 0 ? <ListRow label="No agent connected" /> : null}
            {agents.map((a) => (
              <ListRow
                key={a.id}
                icon={Bot}
                label={a.name}
                sublabel="Connected just now"
                right={<Button label="Disconnect" variant="ghost" onPress={() => disconnect(a.id)} accessibilityLabel={`Disconnect ${a.name}`} />}
              />
            ))}
            <ListRow icon={Plus} label="Connect an agent" onPress={() => setPairing(true)} />
          </ListGroup>

          <View style={styles.block}>
            <SectionHeading>What an agent may do</SectionHeading>
            {AGENT_SCOPES.map((scope) => (
              <Select
                key={scope.key}
                label={scope.label}
                value={permissions[scope.key]}
                options={scope.choices.map((c) => ({ value: c, label: AGENT_PERMISSION_LABEL[c] }))}
                onChange={(v) => setPermission(scope.key, v as AgentPermission)}
              />
            ))}
            <Text style={[styles.helper, { color: t.color.textMuted }]}>
              &quot;Ask me every time&quot; shows you each change before it happens. Nothing is changed until you allow it. Deleting can never be allowed in advance.
            </Text>
          </View>

          <ListGroup title="Requests" footer="When an agent wants to change something, the app asks you like this.">
            <ListRow label="See an example request" onPress={() => setRequest(true)} />
          </ListGroup>

          <View style={styles.block}>
            <SectionHeading>An agent can never</SectionHeading>
            <Card>
              <View style={styles.neverList}>
                {NEVER.map((line) => (
                  <Text key={line} style={[styles.never, { color: t.color.text }]}>
                    {`•  ${line}`}
                  </Text>
                ))}
              </View>
            </Card>
          </View>

          <ListGroup title="Activity" footer="Everything an agent does is listed here, with who did it and when, and each change can be undone.">
            <ListRow label="Nothing yet" />
          </ListGroup>

          {agents.length > 0 ? (
            <ListGroup>
              <ListRow
                label="Disconnect every agent"
                danger
                chevron={false}
                onPress={() => {
                  disconnectAll();
                  showToast('All agents disconnected.', 'success');
                }}
              />
            </ListGroup>
          ) : null}
        </>
      ) : null}

      <Dialog visible={pairing} onClose={() => setPairing(false)} title="Connect an agent" accessibilityLabel="Connect an agent">
        <Text style={[styles.intro, { color: t.color.text }]}>In your AI app, add Fallback as a connector, then enter this code when it asks.</Text>
        <View style={[styles.code, { backgroundColor: t.color.surface }]}>
          <Text style={[styles.codeText, { color: t.color.text }]} accessibilityLabel="Code: 4 K 7, 9 2 Q">
            4K7 92Q
          </Text>
        </View>
        <Text style={[styles.helper, { color: t.color.textMuted }]}>The code works once and expires in 10 minutes.</Text>
        <Button label="Done" onPress={() => setPairing(false)} fullWidth />
        <Button
          label="Preview: show a connected agent"
          variant="ghost"
          onPress={() => {
            connectExample();
            setPairing(false);
          }}
          fullWidth
        />
      </Dialog>

      <Dialog visible={request} onClose={() => setRequest(false)} title="Claude wants to add a routine" accessibilityLabel="Claude wants to add a routine">
        <Card>
          <View style={styles.reqHead}>
            <TaskIcon icon={Footprints} color={ACCENTS.indigo.base} />
            <View style={styles.reqText}>
              <Text style={[styles.reqName, { color: t.color.text }]}>Evening walk</Text>
              <Text style={[styles.helper, { color: t.color.textMuted }]}>Routine · Daily</Text>
            </View>
          </View>
          <Text style={[styles.reqLine, { color: t.color.text }]}>
            <Text style={{ color: t.color.idealDeep, fontWeight: '700' }}>Ideal </Text>20-minute walk
          </Text>
          <Text style={[styles.reqLine, { color: t.color.text }]}>
            <Text style={{ color: t.color.fallbackDeep, fontWeight: '700' }}>Fallback </Text>Walk to the corner and back
          </Text>
        </Card>
        <Text style={[styles.helper, { color: t.color.textMuted }]}>Nothing is added unless you allow it. You can undo it afterwards.</Text>
        <ButtonPair primary={{ label: 'Allow once', onPress: () => setRequest(false) }} secondary={{ label: "Don't allow", onPress: () => setRequest(false) }} />
        <Button
          label="Always allow adding tasks"
          variant="ghost"
          onPress={() => {
            setPermission('write', 'allow');
            setRequest(false);
          }}
          fullWidth
        />
      </Dialog>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: SPACE.s2 + 4 },
  noteRow: { flexDirection: 'row', gap: SPACE.s2 + 4, alignItems: 'flex-start' },
  note: { flex: 1, fontSize: FONT_SIZE.sm, lineHeight: 20 },
  intro: { fontSize: FONT_SIZE.base, lineHeight: 24 },
  helper: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
  neverList: { gap: SPACE.s2 },
  never: { fontSize: FONT_SIZE.base, lineHeight: 22 },
  code: { borderRadius: RADIUS.md, paddingVertical: SPACE.s3, alignItems: 'center' },
  codeText: { fontSize: FONT_SIZE.xxl, fontWeight: '700', letterSpacing: 4, fontVariant: ['tabular-nums'] },
  reqHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 + 4 },
  reqText: { flex: 1, gap: 2 },
  reqName: { fontSize: FONT_SIZE.base, fontWeight: '600' },
  reqLine: { fontSize: FONT_SIZE.base, lineHeight: 22 },
});
