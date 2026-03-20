(() => {
  'use strict';

  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzkkTAoGfq9Tw2MQQluovcThChMYxFb-jAkjGNpqpf1ERWnk6OJi8JyOHIb_zmqebsfTg/exec';

  const form = document.getElementById('applicationForm');
  const submitBtn = document.getElementById('submitBtn');
  const formMessage = document.getElementById('formMessage');
  const directionInput = document.getElementById('direction');

  const cityInput = document.getElementById('city');
  const cityAutocomplete = document.getElementById('cityAutocomplete');
  const citySuggestions = document.getElementById('citySuggestions');

  const phoneInput = document.getElementById('phone');
  const positionSelect = document.getElementById('position');
  const jobInfo = document.getElementById('jobInfo');
  const ageInput = form.elements.age;

  const errorModal = document.getElementById('errorModal');
  const errorModalText = document.getElementById('errorModalText');
  const errorModalClose = document.getElementById('errorModalClose');

  const criminalRecord = document.getElementById('criminalRecord');
  const criminalArticlesGroup = document.getElementById('criminalArticlesGroup');
  const criminalArticles = document.getElementById('criminalArticles');

  const chronicDiseases = document.getElementById('chronicDiseases');
  const diseasesDescriptionGroup = document.getElementById('diseasesDescriptionGroup');
  const diseasesDescription = document.getElementById('diseasesDescription');

  const dismissed = document.getElementById('dismissed');
  const dismissReasonGroup = document.getElementById('dismissReasonGroup');
  const dismissReason = document.getElementById('dismissReason');

  const cities = Array.isArray(window.RUSSIAN_CITIES) ? window.RUSSIAN_CITIES : [];
  const positionsData = window.POSITIONS_DATA || {};

  let currentSuggestions = [];
  let activeSuggestionIndex = -1;
  let cityTimer = null;
  let ageModalShown = false;

  function showMessage(text, type) {
    formMessage.textContent = text;
    formMessage.className = 'form-message';
    formMessage.classList.add(type);
  }

  function clearMessage() {
    formMessage.textContent = '';
    formMessage.className = 'form-message';
  }

  function openErrorModal(message) {
    if (!errorModal || !errorModalText) return;
    errorModalText.textContent = message;
    errorModal.classList.remove('hidden');
    errorModal.setAttribute('aria-hidden', 'false');
    if (errorModalClose) setTimeout(() => errorModalClose.focus(), 0);
  }

  function closeErrorModal() {
    if (!errorModal) return;
    errorModal.classList.add('hidden');
    errorModal.setAttribute('aria-hidden', 'true');
    ageModalShown = false;
  }

  function setError(fieldName, message) {
    const field = form.elements[fieldName];
    const errorEl = document.querySelector(`[data-error-for="${fieldName}"]`);
    if (field) field.classList.add('error-field');
    if (errorEl) errorEl.textContent = message;
  }

  function clearError(fieldName) {
    const field = form.elements[fieldName];
    const errorEl = document.querySelector(`[data-error-for="${fieldName}"]`);
    if (field) field.classList.remove('error-field');
    if (errorEl) errorEl.textContent = '';
  }

  function clearAllErrors() {
    ['fullName','age','city','phone','position','rank','criminalRecord','criminalArticles','chronicDiseases','diseasesDescription','dismissed','dismissReason','consent'].forEach(clearError);
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toggleField(group, input, show) {
    group.classList.toggle('hidden', !show);
    input.required = show;
    if (!show) {
      input.value = '';
      clearError(input.name);
    }
  }

  function updateConditionalFields() {
    toggleField(criminalArticlesGroup, criminalArticles, criminalRecord.value === 'Да');
    toggleField(diseasesDescriptionGroup, diseasesDescription, chronicDiseases.value === 'Да');
    toggleField(dismissReasonGroup, dismissReason, dismissed.value === 'Да');
  }

  function maskPhone(value) {
    const digits = value.replace(/\D/g, '');
    let cleaned = digits;
    if (!cleaned.startsWith('8')) cleaned = '8' + cleaned.replace(/^7/, '');
    cleaned = cleaned.slice(0, 11);
    const d = cleaned.split('');
    let out = d[0] || '8';
    if (d.length > 1) out += ' (' + d.slice(1, 4).join('');
    if (d.length >= 4) out += ')';
    if (d.length > 4) out += ' ' + d.slice(4, 7).join('');
    if (d.length > 7) out += '-' + d.slice(7, 9).join('');
    if (d.length > 9) out += '-' + d.slice(9, 11).join('');
    return out;
  }

  function validatePhone(value) {
    const digits = value.replace(/\D/g, '');
    return digits.length === 11 && digits.startsWith('8');
  }

  function renderJobInfo(groupKey) {
    const item = positionsData[groupKey];
    if (!item) {
      jobInfo.classList.add('hidden');
      jobInfo.innerHTML = '';
      directionInput.value = '';
      return;
    }
    directionInput.value = item.label;
    jobInfo.innerHTML = `
      <div class="job-info__title">${item.label}</div>
      <ul class="job-info__list">
        ${item.conditions.map(condition => `<li>${condition}</li>`).join('')}
      </ul>
    `;
    jobInfo.classList.remove('hidden');
  }

  function populatePositions() {
    positionSelect.innerHTML = '<option value="">Выберите должность</option>';
    Object.entries(positionsData).forEach(([key, group]) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.label;
      group.positions.forEach((position) => {
        const option = document.createElement('option');
        option.value = `${key}|||${position}`;
        option.textContent = position;
        optgroup.appendChild(option);
      });
      positionSelect.appendChild(optgroup);
    });
  }

  function handlePositionChange() {
    const value = positionSelect.value;
    if (!value) {
      renderJobInfo('');
      return;
    }
    const [groupKey] = value.split('|||');
    renderJobInfo(groupKey);
  }

  function getCityMatches(query) {
    const q = normalize(query);
    if (!q) return [];
    return cities.filter(city => normalize(city).startsWith(q)).slice(0, 10);
  }

  function closeSuggestions() {
    citySuggestions.innerHTML = '';
    citySuggestions.classList.add('hidden');
    cityInput.setAttribute('aria-expanded', 'false');
    currentSuggestions = [];
    activeSuggestionIndex = -1;
  }

  function renderSuggestions(items, query) {
    if (!query.trim()) {
      closeSuggestions();
      return;
    }
    if (!items.length) {
      citySuggestions.innerHTML = '<div class="autocomplete__empty">Город не найден</div>';
      citySuggestions.classList.remove('hidden');
      cityInput.setAttribute('aria-expanded', 'true');
      currentSuggestions = [];
      activeSuggestionIndex = -1;
      return;
    }
    citySuggestions.innerHTML = items.map((city, index) => `<div class="autocomplete__item" data-index="${index}" data-value="${city.replace(/"/g, '&quot;')}">${city}</div>`).join('');
    citySuggestions.classList.remove('hidden');
    cityInput.setAttribute('aria-expanded', 'true');
    currentSuggestions = items;
    activeSuggestionIndex = -1;
  }

  function setActiveSuggestion(index) {
    const items = citySuggestions.querySelectorAll('.autocomplete__item');
    items.forEach((item) => item.classList.remove('active'));
    if (index >= 0 && index < items.length) {
      items[index].classList.add('active');
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  function getSelectedGroupKey() {
    const value = positionSelect.value || '';
    if (!value.includes('|||')) return '';
    return value.split('|||')[0];
  }

  function getAgeLimitBySelectedPosition() {
    const groupKey = getSelectedGroupKey();
    if (!groupKey) return null;
    if (groupKey === 'general-distribution') return 63;
    return 55;
  }

  function validateAgeByPosition(forceReset = false, showDialog = false) {
    const rawValue = String(ageInput.value || '').trim();
    const ageLimit = getAgeLimitBySelectedPosition();

    if (ageLimit === null) {
      clearError('age');
      ageModalShown = false;
      return true;
    }

    if (!rawValue) {
      clearError('age');
      ageModalShown = false;
      return true;
    }

    const age = Number(rawValue);
    if (Number.isNaN(age) || age < 18) {
      setError('age', 'Возраст должен быть не меньше 18 лет');
      ageModalShown = false;
      return false;
    }

    if (age > ageLimit) {
      if (forceReset) ageInput.value = '';
      setError('age', 'Превышен максимальный возраст для вакансии');
      if (showDialog && !ageModalShown) {
        ageModalShown = true;
        openErrorModal('Превышен максимальный возраст для выбранной должности');
      }
      return false;
    }

    clearError('age');
    ageModalShown = false;
    return true;
  }

  function validateForm() {
    clearAllErrors();
    let valid = true;
    const required = [
      ['fullName', 'Укажите ФИО'],
      ['age', 'Укажите возраст'],
      ['city', 'Укажите город'],
      ['phone', 'Укажите телефон'],
      ['position', 'Выберите должность'],
      ['rank', 'Укажите звание'],
      ['criminalRecord', 'Выберите значение'],
      ['chronicDiseases', 'Выберите значение'],
      ['dismissed', 'Выберите значение']
    ];
    required.forEach(([name, message]) => {
      const field = form.elements[name];
      if (!field || !String(field.value).trim()) {
        setError(name, message);
        valid = false;
      }
    });
    if (!validateAgeByPosition(false, true)) valid = false;
    if (form.elements.phone.value && !validatePhone(form.elements.phone.value)) {
      setError('phone', 'Введите телефон в формате 8 (999) 999-99-99');
      valid = false;
    }
    if (criminalRecord.value === 'Да' && !criminalArticles.value.trim()) {
      setError('criminalArticles', 'Укажите статьи');
      valid = false;
    }
    if (chronicDiseases.value === 'Да' && !diseasesDescription.value.trim()) {
      setError('diseasesDescription', 'Опишите заболевания');
      valid = false;
    }
    if (dismissed.value === 'Да' && !dismissReason.value.trim()) {
      setError('dismissReason', 'Укажите причину');
      valid = false;
    }
    if (!form.elements.consent.checked) {
      setError('consent', 'Необходимо дать согласие');
      valid = false;
    }
    return valid;
  }

  function collectData() {
    const [groupKey, positionName] = (positionSelect.value || '|||').split('|||');
    return {
      fullName: form.elements.fullName.value.trim(),
      age: form.elements.age.value.trim(),
      city: form.elements.city.value.trim(),
      phone: form.elements.phone.value.trim(),
      direction: positionsData[groupKey]?.label || '',
      position: positionName || '',
      criminalRecord: criminalRecord.value,
      criminalArticles: criminalArticles.value.trim(),
      chronicDiseases: chronicDiseases.value,
      diseasesDescription: diseasesDescription.value.trim(),
      rank: form.elements.rank.value.trim(),
      dismissed: dismissed.value,
      dismissReason: dismissReason.value.trim(),
      consent: form.elements.consent.checked ? 'Да' : 'Нет',
      clientCreatedAt: new Date().toISOString()
    };
  }

  async function submitForm(data) {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data),
      redirect: 'follow'
    });
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error('Сервер вернул некорректный ответ');
    }
    if (!response.ok || !result.success) {
      throw new Error(result.message || `HTTP ${response.status}`);
    }
    return result;
  }

  function initSlider() {
    const slider = document.getElementById('heroSlider');
    const total = 10;
    const slides = [];
    const sourceSetSupported = CSS.supports('background-image', 'image-set(url("x.webp") type("image/webp"))');
    for (let i = 1; i <= total; i += 1) {
      const slide = document.createElement('div');
      slide.className = 'hero__slide';
      const base = `images/soldier${i}`;
      slide.style.backgroundImage = sourceSetSupported
        ? `image-set(url("${base}.webp") type("image/webp"), url("${base}.jpg") type("image/jpeg"))`
        : `url("${base}.jpg")`;
      slider.appendChild(slide);
      slides.push(slide);
    }
    let current = 0;
    if (slides[0]) slides[0].classList.add('is-active');
    const preload = (index) => {
      const img = new Image();
      img.loading = 'lazy';
      img.src = `images/soldier${index}.webp`;
    };
    preload(1);
    preload(2);
    setInterval(() => {
      slides[current].classList.remove('is-active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('is-active');
      preload(((current + 1) % slides.length) + 1);
    }, 5000);
  }

  populatePositions();
  renderJobInfo('');
  updateConditionalFields();
  initSlider();

  phoneInput.addEventListener('input', (event) => {
    event.target.value = maskPhone(event.target.value);
    clearError('phone');
  });

  cityInput.addEventListener('input', (event) => {
    clearError('city');
    clearTimeout(cityTimer);
    cityTimer = setTimeout(() => {
      renderSuggestions(getCityMatches(event.target.value), event.target.value);
    }, 300);
  });

  cityInput.addEventListener('keydown', (event) => {
    const items = citySuggestions.querySelectorAll('.autocomplete__item');
    if (!items.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeSuggestionIndex = activeSuggestionIndex < items.length - 1 ? activeSuggestionIndex + 1 : 0;
      setActiveSuggestion(activeSuggestionIndex);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeSuggestionIndex = activeSuggestionIndex > 0 ? activeSuggestionIndex - 1 : items.length - 1;
      setActiveSuggestion(activeSuggestionIndex);
    }
    if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault();
      cityInput.value = currentSuggestions[activeSuggestionIndex];
      closeSuggestions();
    }
    if (event.key === 'Escape') closeSuggestions();
  });

  citySuggestions.addEventListener('click', (event) => {
    const item = event.target.closest('.autocomplete__item');
    if (!item) return;
    cityInput.value = item.dataset.value;
    closeSuggestions();
  });

  document.addEventListener('click', (event) => {
    if (!cityAutocomplete.contains(event.target)) closeSuggestions();
  });

  positionSelect.addEventListener('change', () => {
    clearError('position');
    handlePositionChange();
    if (String(ageInput.value || '').trim()) {
      validateAgeByPosition(true, true);
    }
  });

  ageInput.addEventListener('input', () => {
    if (getAgeLimitBySelectedPosition() !== null) {
      validateAgeByPosition(false, false);
    }
  });

  ageInput.addEventListener('change', () => {
    if (getAgeLimitBySelectedPosition() !== null) {
      validateAgeByPosition(true, true);
    }
  });

  if (errorModalClose) errorModalClose.addEventListener('click', closeErrorModal);
  if (errorModal) {
    errorModal.addEventListener('click', (event) => {
      if (event.target && event.target.hasAttribute('data-close-modal')) closeErrorModal();
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeErrorModal();
  });

  criminalRecord.addEventListener('change', updateConditionalFields);
  chronicDiseases.addEventListener('change', updateConditionalFields);
  dismissed.addEventListener('change', updateConditionalFields);

  form.addEventListener('input', (event) => {
    if (event.target?.name) clearError(event.target.name);
    clearMessage();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();

    if (window.location.protocol === 'file:') {
      showMessage('Откройте лендинг через локальный сервер: http://localhost:8000. Из file:// запросы блокируются браузером.', 'error');
      return;
    }

    updateConditionalFields();
    if (!validateForm()) {
      showMessage('Проверьте корректность заполнения формы.', 'error');
      return;
    }

    const payload = collectData();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';

    try {
      const result = await submitForm(payload);
      showMessage(result.message || 'Заявка отправлена', 'success');
      form.reset();
      positionSelect.selectedIndex = 0;
      renderJobInfo('');
      updateConditionalFields();
      closeSuggestions();
      closeErrorModal();
    } catch (error) {
      showMessage(error.message || 'Ошибка при отправке данных', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Отправить заявку';
    }
  });
})();