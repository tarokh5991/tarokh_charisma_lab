update public.lessons set body = jsonb_set(body, '{ai,scenario}', to_jsonb('مکث در جلسه'::text)) where slug = 'voice-that-carries';
update public.lessons set body = jsonb_set(body, '{ai,scenario}', to_jsonb('شنیدن در گفت‌وگو'::text)) where slug = 'real-listening';
update public.lessons set body = jsonb_set(body, '{ai,scenario}', to_jsonb('نه گفتن محترمانه'::text)) where slug = 'short-and-firm';
update public.lessons set body = jsonb_set(body, '{ai,scenario}', to_jsonb('تنظیم گفت‌وگو'::text)) where slug = 'reading-the-room';
update public.lessons set body = jsonb_set(body, '{ai,scenario}', to_jsonb('تعریف دقیق'::text)) where slug = 'specific-attention';
