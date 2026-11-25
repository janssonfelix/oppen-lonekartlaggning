// SPDX-License-Identifier: MIT
// Copyright 2026 Felix Jansson
// Varje test måste pröva något: ett test utan påstående (en slinga över en tom lista, ett villkor som aldrig blir
// sant) faller i stället för att vara grönt.
import { beforeEach, expect } from 'vitest';

beforeEach(() => { expect.hasAssertions(); });
