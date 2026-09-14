const carousels = document.querySelectorAll('[data-carousel-name]');

function showSlide(carousel, slideIndex) {
    const slides = carousel.querySelectorAll('.slide, .merch-card');
    const dots = document.querySelectorAll(`.dot[data-carousel="${carousel.dataset.carouselName}"]`);
    const isMerchCarousel = carousel.dataset.carouselName === 'merch-reel';
    const visibleSlides = isMerchCarousel && window.innerWidth > 760 ? 4 : 1;
    const maxStartIndex = Math.max(0, slides.length - visibleSlides);
    const nextIndex = isMerchCarousel
        ? Math.max(0, Math.min(slideIndex, maxStartIndex))
        : (slideIndex + slides.length) % slides.length;

    slides.forEach((slide, index) => {
        const isVisible = isMerchCarousel
            ? index >= nextIndex && index < nextIndex + visibleSlides
            : index === nextIndex;
        slide.classList.toggle('is-active', isVisible);
    });
    dots.forEach((dot, index) => dot.classList.toggle('is-active', index === nextIndex));
    carousel.dataset.currentSlide = nextIndex;
}

document.querySelectorAll('[data-direction]').forEach((button) => {
    button.addEventListener('click', () => {
        const carousel = document.querySelector(`[data-carousel-name="${button.dataset.carousel}"]`);
        const currentSlide = Number(carousel.dataset.currentSlide || 0);
        showSlide(carousel, button.dataset.direction === 'next' ? currentSlide + 1 : currentSlide - 1);
    });
});

document.querySelectorAll('[data-slide]').forEach((button) => {
    button.addEventListener('click', () => {
        const carousel = document.querySelector(`[data-carousel-name="${button.dataset.carousel}"]`);
        showSlide(carousel, Number(button.dataset.slide));
    });
});

carousels.forEach((carousel) => {
    carousel.dataset.currentSlide = 0;
});
